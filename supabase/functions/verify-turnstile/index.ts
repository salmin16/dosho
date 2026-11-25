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
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Sliding-window in-memory per-user rate limit for mobile fallback requests (10 reqs / 10 min)
const FALLBACK_WINDOW_MS = 10 * 60 * 1000;
const FALLBACK_MAX_REQUESTS = 10;
const userFallbackAttempts = new Map<string, number[]>();

function checkUserRateLimit(userId: string): boolean {
  const now = Date.now();
  const prev = (userFallbackAttempts.get(userId) ?? []).filter(
    (ts) => now - ts < FALLBACK_WINDOW_MS,
  );
  if (prev.length >= FALLBACK_MAX_REQUESTS) {
    userFallbackAttempts.set(userId, prev);
    return false;
  }
  prev.push(now);
  userFallbackAttempts.set(userId, prev);
  return true;
}

interface VerifyRequestBody {
  token?: string;
  action?: string;
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
  payload: { success: boolean; error?: string; verifiedBy?: string },
  status: number,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed.' }, 405);
  }

  const secretKey = Deno.env
    .get('TURNSTILE_SECRET_KEY')
    ?.trim()
    .replace(/^["']|["']$/g, '');

  if (!secretKey) {
    return jsonResponse(
      { success: false, error: 'Server security verification is not configured.' },
      500,
    );
  }

  let body: VerifyRequestBody;
  try {
    body = (await req.json()) as VerifyRequestBody;
  } catch {
    return jsonResponse({ success: false, error: 'Invalid request payload.' }, 400);
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const bypassReason =
    typeof body.turnstileBypassReason === 'string'
      ? body.turnstileBypassReason.trim()
      : '';

  // Graceful mobile/cellular fallback: when Turnstile widget timed out client-side,
  // verify the caller's authenticated Supabase user JWT + enforce per-user rate limit.
  if (!token && bypassReason === 'timeout_or_mobile_challenge') {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
    const jwt = (req.headers.get('Authorization') ?? '')
      .replace(/^Bearer\s+/i, '')
      .trim();

    if (!supabaseUrl || !serviceRoleKey || !jwt) {
      return jsonResponse(
        {
          success: false,
          error: 'User Auth Error: Sign in required for mobile security fallback.',
        },
        401,
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(jwt);
    if (authErr || !userData?.user) {
      return jsonResponse(
        {
          success: false,
          error: 'User Auth Error: Invalid or expired session for fallback verification.',
        },
        401,
      );
    }

    if (!checkUserRateLimit(userData.user.id)) {
      return jsonResponse(
        {
          success: false,
          error: 'Too many verification attempts. Please wait a few minutes and try again.',
        },
        429,
      );
    }

    return jsonResponse(
      { success: true, verifiedBy: 'authenticated_session_fallback' },
      200,
    );
  }

  if (!token) {
    return jsonResponse(
      { success: false, error: 'Missing security verification token.' },
      403,
    );
  }

  const remoteIp =
    sanitizeIp(req.headers.get('cf-connecting-ip')) ??
    sanitizeIp(req.headers.get('x-forwarded-for'));

  try {
    const verifyPayload: Record<string, string> = {
      secret: secretKey,
      response: token,
    };
    if (remoteIp) {
      verifyPayload.remoteip = remoteIp;
    }

    const upstream = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(verifyPayload),
    });

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
          success: false,
          error: 'Security verification service is temporarily unavailable. Please retry.',
        },
        403,
      );
    }

    if (outcome?.success !== true) {
      console.warn('[verify-turnstile] Cloudflare rejected token:', {
        action: body.action ?? 'unspecified',
        errorCodes: outcome?.['error-codes'] ?? [],
      });
      return jsonResponse(
        {
          success: false,
          error:
            'Security verification failed or expired. Please complete the challenge again.',
        },
        403,
      );
    }

    if (!isHostnameAllowed(outcome.hostname)) {
      console.warn('[verify-turnstile] Disallowed hostname:', outcome.hostname);
      return jsonResponse(
        {
          success: false,
          error: 'Security verification failed for this domain. Please refresh and try again.',
        },
        403,
      );
    }

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    console.warn('[verify-turnstile] Verification exception:', err);
    return jsonResponse(
      {
        success: false,
        error: 'Unable to complete security verification. Please retry.',
      },
      403,
    );
  }
});
