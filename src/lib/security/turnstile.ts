/**
 * Server-Side Cloudflare Turnstile Verification Helper (`src/lib/security/turnstile.ts`)
 * Verifies Turnstile tokens against https://challenges.cloudflare.com/turnstile/v0/siteverify
 * using the server-only `TURNSTILE_SECRET_KEY` environment variable.
 *
 * NEVER import this file in client components or expose TURNSTILE_SECRET_KEY to browser bundles.
 */

const TURNSTILE_SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerifyResult {
  success: boolean;
  status: 200 | 403 | 500;
  error?: string;
  errorCodes?: string[];
  hostname?: string;
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null
): Promise<TurnstileVerifyResult> {
  const secretKey =
    typeof process !== 'undefined' ? process.env.TURNSTILE_SECRET_KEY?.trim() : undefined;

  // If TURNSTILE_SECRET_KEY is not configured in development/staging, bypass cleanly only outside strict enforcement
  if (!secretKey) {
    const isProd =
      typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
    const siteKeyConfigured = Boolean(
      typeof process !== 'undefined' &&
        (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
          process.env.VITE_TURNSTILE_SITE_KEY)
    );
    if (isProd && siteKeyConfigured) {
      return {
        success: false,
        status: 500,
        error:
          'Security verification misconfiguration: TURNSTILE_SECRET_KEY is missing on server.',
      };
    }
    return { success: true, status: 200 };
  }

  const trimmedToken = typeof token === 'string' ? token.trim() : '';
  if (!trimmedToken) {
    return {
      success: false,
      status: 403,
      error: '403 Forbidden: Missing Cloudflare Turnstile security verification token.',
    };
  }

  try {
    const formBody = new URLSearchParams();
    formBody.append('secret', secretKey);
    formBody.append('response', trimmedToken);
    if (remoteIp && remoteIp.trim().length > 0) {
      formBody.append('remoteip', remoteIp.trim());
    }

    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    });

    if (!response.ok) {
      return {
        success: false,
        status: 403,
        error: `Turnstile verification upstream returned HTTP ${response.status}.`,
      };
    }

    const result = (await response.json()) as {
      success?: boolean;
      hostname?: string;
      'error-codes'?: string[];
    };

    if (!result.success) {
      return {
        success: false,
        status: 403,
        error:
          '403 Forbidden: Security verification failed or expired. Please complete the challenge again.',
        errorCodes: result['error-codes'] ?? [],
      };
    }

    return {
      success: true,
      status: 200,
      hostname: result.hostname,
    };
  } catch (err) {
    return {
      success: false,
      status: 403,
      error:
        err instanceof Error
          ? `403 Forbidden: Turnstile verification error (${err.message}).`
          : '403 Forbidden: Unable to verify Turnstile security token.',
    };
  }
}
