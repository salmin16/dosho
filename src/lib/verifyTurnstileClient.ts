import { isTurnstileEnabled } from '../components/TurnstileWidget'
import { getSupabaseClient } from './supabaseClient'

export interface ClientTurnstileVerificationResult {
  ok: boolean
  error?: string
}

const UUID_REGEX =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/**
 * Converts technical / upstream error messages into clear, executive-friendly copy,
 * guaranteeing raw JSON, SQL/RLS policy names, or internal UUIDs never appear in UI banners.
 */
export function formatSafeUserError(
  rawMessage: string | null | undefined,
  fallback = 'We could not complete your request right now. Please try again.',
): string {
  const msg = (rawMessage ?? '').trim()
  if (!msg) return fallback

  if (/captcha|turnstile|invalid-input-response|timeout-or-duplicate/i.test(msg)) {
    return 'Security verification expired or could not be confirmed. Please complete the check and try again.'
  }
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
): Promise<ClientTurnstileVerificationResult> {
  if (!isTurnstileEnabled()) {
    return { ok: true }
  }

  const trimmed = token.trim()
  if (!trimmed) {
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
      body: { token: trimmed, action },
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
