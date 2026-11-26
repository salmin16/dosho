// Supabase Edge Function: Server-side Cloudflare Turnstile verification
// Secret `TURNSTILE_SECRET_KEY` must be configured in Supabase Edge Function secrets:
//   supabase secrets set TURNSTILE_SECRET_KEY=0x4AAAAAAA...
// Never expose TURNSTILE_SECRET_KEY to browser bundles or client environment variables.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const TURNSTILE_SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const DEFAULT_ALLOWED_HOSTNAMES = [
  'mineconnect-mocha.vercel.app',
  'salmin-three.vercel.app',
  'localhost',
  '127.0.0.1',
];

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Sliding-window in-memory rate limits for mobile/WebView fallback requests
const FALLBACK_WINDOW_MS = 10 * 60 * 1000;
const FALLBACK_MAX_REQUESTS = 20;
const NETWORK_FALLBACK_MAX_REQUESTS = 25;
const SITEVERIFY_TIMEOUT_MS = 4500;
const userFallbackAttempts = new Map<string, number[]>();

function checkFallbackRateLimit(key: string, maxRequests: number): boolean {
  const now = Date.now();
  const prev = (userFallbackAttempts.get(key) ?? []).filter(
    (ts) => now - ts < FALLBACK_WINDOW_MS,
  );
  if (prev.length >= maxRequests) {
    userFallbackAttempts.set(key, prev);
    return false;
  }
  prev.push(now);
  userFallbackAttempts.set(key, prev);
  return true;
}

interface VerifyRequestBody {
  token?: string;
  action?: string;
  fallback?: boolean;
  turnstileBypassReason?: string;
}

interface TurnstileSiteverifyOutcome {
  success?: boolean;
  hostname?: string;
  action?: string;
  'error-codes'?: string[];
}

function sanitizeIp(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const candidate = raw.split(',')[0]?.trim() ?? '';
  if (/^[0-9a-fA-F:.]{3,45}$/.test(candidate)) {
    return candidate;
  }
  return undefined;
}

function getAllowedHostnames(): Set<string> {
  const extra = (Deno.env.get('TURNSTILE_ALLOWED_HOSTNAMES') ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_HOSTNAMES, ...extra]);
}

function isHostnameAllowed(hostname: string | undefined): boolean {
  if (!hostname) return true;
  const normalized = hostname.trim().toLowerCase().replace(/:\d+$/, '');
  if (!normalized) return true;
  return getAllowedHostnames().has(normalized);
}

function jsonResponse(
  payload: {
    ok?: boolean;
    success: boolean;
    fallback?: boolean;
    rejected?: boolean;
    error?: string;
    errorCodes?: string[];
    verifiedBy?: string;
  },
  status: number,
): Response {
  return new Response(
    JSON.stringify({ ok: payload.ok ?? payload.success, ...payload }),
    {
      status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    },
  );
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed.' }, 405);
  }

  let body: VerifyRequestBody = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === 'object') {
      body = parsed as VerifyRequestBody;
    }
  } catch {
    body = {};
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const isFallbackRequested = body.fallback === true;
  const bypassReason =
    typeof body.turnstileBypassReason === 'string'
      ? body.turnstileBypassReason.trim()
      : '';
  const action =
    typeof body.action === 'string' && body.action.trim()
      ? body.action.trim().toLowerCase()
      : 'unspecified';

  const remoteIp =
    sanitizeIp(req.headers.get('cf-connecting-ip')) ??
    sanitizeIp(req.headers.get('x-forwarded-for'));

  // Graceful fallback path: when `fallback === true`, bypass reason is set, or no Turnstile
  // token was issued by the client (e.g. mobile Safari / WhatsApp in-app WebView),
  // NEVER call Cloudflare siteverify with an empty token and NEVER return a 400/403 block.
  if (isFallbackRequested || !token || bypassReason === 'timeout_or_mobile_challenge') {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
    const jwt = (req.headers.get('Authorization') ?? '')
      .replace(/^Bearer\s+/i, '')
      .trim();

    if (jwt && supabaseUrl && serviceRoleKey) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(jwt);
        if (!authErr && userData?.user) {
          if (!checkFallbackRateLimit(`user:${userData.user.id}`, FALLBACK_MAX_REQUESTS)) {
            return jsonResponse(
              {
                success: false,
                fallback: true,
                error: 'Too many verification attempts. Please wait a few minutes and try again.',
              },
              429,
            );
          }

          return jsonResponse(
            {
              success: true,
              fallback: true,
              verifiedBy: 'authenticated_session_fallback',
            },
            200,
          );
        }
      } catch (err) {
        console.warn('[verify-turnstile] Session fallback lookup warning:', err);
      }
    }

    const rateKey = `ip:${remoteIp ?? 'unknown'}:${action}`;
    if (!checkFallbackRateLimit(rateKey, NETWORK_FALLBACK_MAX_REQUESTS)) {
      return jsonResponse(
        {
          success: false,
          fallback: true,
          error: 'Too many attempts from this network. Please wait a few minutes and try again.',
        },
        429,
      );
    }

    return jsonResponse(
      {
        success: true,
        fallback: true,
        verifiedBy: 'network_fallback',
      },
      200,
    );
  }

  // Non-empty Turnstile token provided: validate against Cloudflare siteverify
  const secretKey = Deno.env
    .get('TURNSTILE_SECRET_KEY')
    ?.trim()
    .replace(/^["']|["']$/g, '');

  if (!secretKey) {
    console.warn('[verify-turnstile] TURNSTILE_SECRET_KEY missing; falling back cleanly.');
    return jsonResponse(
      {
        success: true,
        fallback: true,
        verifiedBy: 'server_fallback',
      },
      200,
    );
  }

  try {
    const verifyPayload: Record<string, string> = {
      secret: secretKey,
      response: token,
    };
    if (remoteIp) {
      verifyPayload.remoteip = remoteIp;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SITEVERIFY_TIMEOUT_MS);

    let upstream: Response;
    try {
      upstream = await fetch(TURNSTILE_SITEVERIFY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(verifyPayload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const rawText = await upstream.text();
    let outcome: TurnstileSiteverifyOutcome | null = null;
    try {
      outcome = JSON.parse(rawText) as TurnstileSiteverifyOutcome;
    } catch {
      outcome = null;
    }

    if (!upstream.ok && !outcome) {
      console.warn('[verify-turnstile] Upstream HTTP failure:', upstream.status);
      return jsonResponse(
        {
          ok: true,
          success: true,
          fallback: true,
          verifiedBy: 'upstream_http_fallback',
        },
        200,
      );
    }

    if (outcome?.success !== true) {
      const errorCodes = outcome?.['error-codes'] ?? [];
      console.warn('[verify-turnstile] Cloudflare rejected token:', {
        action,
        errorCodes,
      });
      return jsonResponse(
        {
          ok: false,
          success: false,
          fallback: false,
          rejected: true,
          errorCodes,
          error:
            'Security verification token was rejected or expired. Please complete the challenge or retry.',
        },
        200,
      );
    }

    if (!isHostnameAllowed(outcome.hostname)) {
      console.warn('[verify-turnstile] Disallowed hostname:', outcome.hostname);
      return jsonResponse(
        {
          ok: false,
          success: false,
          fallback: false,
          rejected: true,
          error: 'Security verification failed for this domain. Please refresh and try again.',
        },
        200,
      );
    }

    return jsonResponse(
      { ok: true, success: true, fallback: false, verifiedBy: 'turnstile' },
      200,
    );
  } catch (err) {
    console.warn('[verify-turnstile] Verification exception/timeout:', err);
    return jsonResponse(
      {
        ok: true,
        success: true,
        fallback: true,
        verifiedBy: 'upstream_timeout_fallback',
      },
      200,
    );
  }
});
