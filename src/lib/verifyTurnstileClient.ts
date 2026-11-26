import { isTurnstileEnabled } from '../components/TurnstileWidget'
import { getSupabaseClient } from './supabaseClient'

export interface ClientTurnstileVerificationResult {
  ok: boolean
  fallback?: boolean
  rejected?: boolean
  error?: string
}

const UUID_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/**
 * Converts technical / upstream error messages into clear, executive-friendly copy,
 * guaranteeing raw JSON, SQL/RLS policy names, or internal UUIDs never appear in UI banners,
 * while always surfacing actual Supabase Auth credential/account errors cleanly.
 */
export function formatSafeUserError(
  rawMessage: string | null | undefined,
  fallback = 'We could not complete your request right now. Please try again.',
): string {
  const msg = (rawMessage ?? '').trim()
  if (!msg) return fallback

  // Always surface actual Supabase Auth credential/account errors first
  if (/invalid login credentials/i.test(msg)) {
    return 'Invalid email or password. Please check your credentials and try again.'
  }
  if (/email not confirmed/i.test(msg)) {
    return 'Please confirm your email address via the link sent to your inbox before logging in.'
  }
  if (/user already registered|already been registered/i.test(msg)) {
    return 'An account with this email address already exists. Please log in instead.'
  }
  if (/rate limit|too many requests|for security purposes/i.test(msg)) {
    return 'Too many attempts. Please wait a moment before trying again.'
  }
  if (/captcha|turnstile|invalid-input-response|timeout-or-duplicate/i.test(msg)) {
    return 'Security verification expired or could not be completed. Tap Retry Verification below (or open in Chrome / Safari if using an in-app browser).'
  }
  if (
    msg.startsWith('{') ||
    msg.startsWith('[') ||
    /row-level security|rls|auth\.uid|pgrst|postgres|relation\s+"|violates\s+.*policy|duplicate key value/i.test(
      msg,
    ) ||
    UUID_REGEX.test(msg)
  ) {
    return fallback
  }

  return msg
}

/**
 * Validates a Cloudflare Turnstile token for high-risk non-auth forms
 * (project listings, quote requests, compliance complaints).
 *
 * Calls the `verify-turnstile` Supabase Edge Function (which holds `TURNSTILE_SECRET_KEY`
 * strictly server-side and verifies against Cloudflare's `/siteverify` endpoint).
 */
export async function verifyTurnstileForForm(
  token: string,
  action:
    | 'list-project'
    | 'request-quote'
    | 'compliance-complaint'
    | 'subscription-payment',
  options?: { fallback?: boolean },
): Promise<ClientTurnstileVerificationResult> {
  if (!isTurnstileEnabled()) {
    return { ok: true }
  }

  const trimmed = token.trim()
  const useFallback = Boolean(!trimmed && options?.fallback)
  if (!trimmed && !useFallback) {
    return {
      ok: false,
      error: 'Please complete the security verification check before submitting.',
    }
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return {
      ok: false,
      error: 'Security verification service is unavailable. Please try again later.',
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke<{
      success?: boolean
      error?: string
    }>('verify-turnstile', {
      body: useFallback
        ? {
            fallback: true,
            turnstileBypassReason: 'timeout_or_mobile_challenge',
            action,
          }
        : { token: trimmed, action },
    })

    if (error) {
      return {
        ok: false,
        error:
          'Security verification expired or failed. Please complete the check again.',
      }
    }

    if (!data || data.success !== true) {
      return {
        ok: false,
        error: formatSafeUserError(
          data?.error,
          'Security verification failed or expired. Please complete the challenge again.',
        ),
      }
    }

    return { ok: true }
  } catch {
    return {
      ok: false,
      error:
        'Unable to reach the security verification service. Please retry in a moment.',
    }
  }
}

/**
 * Verifies auth requests (login, signup, password reset) via the `verify-turnstile` Edge Function:
 * - When a non-empty `token` is provided, verifies it server-side against Cloudflare `siteverify`
 *   and only blocks if Cloudflare explicitly rejects the token as invalid/tampered.
 * - When no `token` is present (fallback / "Basic network check active" / mobile WebView),
 *   sends `{ fallback: true }` and NEVER blocks `supabase.auth.signInWithPassword` unless
 *   the server explicitly returns HTTP 429 rate-limiting.
 */
export async function verifyTurnstileForAuth(params: {
  token?: string
  fallback?: boolean
  action: 'login' | 'signup' | 'forgot-password'
}): Promise<ClientTurnstileVerificationResult> {
  if (!isTurnstileEnabled()) {
    return { ok: true, fallback: false }
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return { ok: true, fallback: true }
  }

  const trimmedToken = (params.token ?? '').trim()
  const isFallbackMode = !trimmedToken || Boolean(params.fallback)

  try {
    const { data, error } = await supabase.functions.invoke<{
      ok?: boolean
      success?: boolean
      fallback?: boolean
      rejected?: boolean
      error?: string
    }>('verify-turnstile', {
      body: isFallbackMode
        ? {
            token: '',
            fallback: true,
            turnstileBypassReason: 'timeout_or_mobile_challenge',
            action: params.action,
          }
        : {
            token: trimmedToken,
            fallback: false,
            action: params.action,
          },
    })

    // In fallback mode, accept `{ ok: true }` / `{ success: true }` or unreachable edge function;
    // ONLY block on explicit HTTP 429 rate limits.
    if (isFallbackMode) {
      if (data && data.success === false && /too many|rate limit/i.test(data.error ?? '')) {
        return {
          ok: false,
          fallback: true,
          error: formatSafeUserError(
            data.error,
            'Too many attempts from this network. Please wait a moment and try again.',
          ),
        }
      }
      if (error && /429|too many/i.test(error.message ?? '')) {
        return {
          ok: false,
          fallback: true,
          error: 'Too many attempts from this network. Please wait a moment and try again.',
        }
      }
      return { ok: true, fallback: true }
    }

    // Real token was submitted: only block if explicitly rejected as invalid/tampered
    if (data && data.rejected === true) {
      return {
        ok: false,
        fallback: false,
        rejected: true,
        error:
          data.error ||
          'Security verification token was invalid or expired. Please tap Retry and try again.',
      }
    }

    if (data && (data.ok === true || data.success === true)) {
      return { ok: true, fallback: Boolean(data.fallback) }
    }

    // Transient edge-function error: fall back cleanly so Supabase Auth can still validate credentials
    return { ok: true, fallback: true }
  } catch {
    return { ok: true, fallback: true }
  }
}

/**
 * Backward-compatible alias for fallback-only auth verification.
 */
export async function verifyTurnstileAuthFallback(
  action: 'login' | 'signup' | 'forgot-password',
): Promise<ClientTurnstileVerificationResult> {
  return verifyTurnstileForAuth({ fallback: true, action })
}
