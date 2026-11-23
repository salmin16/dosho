// Supabase Edge Function: Server-side Cloudflare Turnstile verification
// Secret `TURNSTILE_SECRET_KEY` must be configured in Supabase Edge Function secrets:
//   supabase secrets set TURNSTILE_SECRET_KEY=0x4AAAAAAA...
// Never expose TURNSTILE_SECRET_KEY to browser bundles or client environment variables.

const TURNSTILE_SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed.' }),
      {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    );
  }

  const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY')?.trim();
  if (!secretKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Server security verification is not configured.',
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    );
  }

  let body: VerifyRequestBody;
  try {
    body = (await req.json()) as VerifyRequestBody;
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid JSON request payload.' }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    );
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Missing Cloudflare Turnstile verification token.',
      }),
      {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    );
  }

  const remoteIp =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '';

  try {
    const formBody = new URLSearchParams();
    formBody.append('secret', secretKey);
    formBody.append('response', token);
    if (remoteIp) {
      formBody.append('remoteip', remoteIp);
    }

    const upstream = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
    });

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Upstream security verification service unavailable.',
        }),
        {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        },
      );
    }

    const result = (await upstream.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
      'error-codes'?: string[];
    };

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Security verification failed or expired. Please complete the challenge again.',
          errorCodes: result['error-codes'] ?? [],
        }),
        {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        hostname: result.hostname ?? null,
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    );
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Unable to complete server-side security verification.',
      }),
      {
        status: 403,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      },
    );
  }
});
