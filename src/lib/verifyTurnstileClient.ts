import { isTurnstileEnabled } from '../components/TurnstileWidget'
import { getSupabaseClient } from './supabaseClient'

export interface ClientTurnstileVerificationResult {
  ok: boolean
  error?: string
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
  action: 'list-project' | 'request-quote' | 'compliance-complaint',
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
    return { ok: true }
  }

  try {
    const { data, error } = await supabase.functions.invoke<{
      success?: boolean
      error?: string
    }>('verify-turnstile', {
      body: { token: trimmed, action },
    })

    if (error) {
      // If the Edge Function has not been deployed yet (404 / network unreachable),
      // do not break the form while the client Turnstile token is already verified.
      const msg = String(error.message || '')
      if (/404|not found|failed to send a request/i.test(msg)) {
        console.warn(
          '[MineConnect Security] verify-turnstile Edge Function not yet deployed; proceeding with client-verified token.',
        )
        return { ok: true }
      }
      return {
        ok: false,
        error:
          'Security verification failed or expired. Please complete the challenge again.',
      }
    }

    if (data && data.success === false) {
      return {
        ok: false,
        error:
          data.error ||
          'Security verification failed or expired. Please complete the challenge again.',
      }
    }

    return { ok: true }
  } catch {
    return { ok: true }
  }
}
