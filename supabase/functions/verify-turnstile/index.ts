// Supabase Edge Function: Server-side Cloudflare Turnstile verification
// Secret `TURNSTILE_SECRET_KEY` must be configured in Supabase Edge Function secrets:
//   supabase secrets set TURNSTILE_SECRET_KEY=0x4AAAAAAA...
// Never expose TURNSTILE_SECRET_KEY to browser bundles or client environment variables.

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

interface VerifyRequestBody {
  token?: string;
  action?: string;
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
  payload: { success: boolean; error?: string },
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
