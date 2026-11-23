import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
} from 'lucide-react'
import {
  completePasswordRecoveryReset,
  useAuthState,
  verifyRecoverySessionFromUrl,
} from '../lib/supabaseAuth'
import { evaluatePasswordRules, validateStrongPassword } from '../lib/validations/auth'
import PasswordStrengthChecklist from '../components/PasswordStrengthChecklist'

export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [{ title: 'Reset password — MineConnect' }] }),
  component: ResetPasswordRouteComponent,
})

function ResetPasswordRouteComponent() {
  const navigate = useNavigate()
  const { passwordRecovery } = useAuthState()

  const [checking, setChecking] = useState(true)
  const [validRecovery, setValidRecovery] = useState(false)
  const [invalidReason, setInvalidReason] = useState(
    'This password reset link is invalid or has expired.'
  )

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updated, setUpdated] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      const result = await verifyRecoverySessionFromUrl()
      if (!active) return
      if (result.valid) {
        setValidRecovery(true)
      } else {
        setValidRecovery(false)
        if (result.reason) setInvalidReason(result.reason)
      }
      setChecking(false)
    })()
    return () => {
      active = false
    }
  }, [])

  // Also unlock automatically if Supabase fires PASSWORD_RECOVERY slightly after mount
  useEffect(() => {
    if (passwordRecovery) {
      setValidRecovery(true)
      setChecking(false)
    }
  }, [passwordRecovery])

  // Clean auto-redirect to Sign In after successful password update
  useEffect(() => {
    if (!updated) return
    const timer = window.setTimeout(() => {
      navigate({
        to: '/login',
        search: { reset: 'success' } as unknown as undefined,
        replace: true,
      })
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [updated, navigate])

  const evaluation = evaluatePasswordRules(newPassword)
  const passwordsMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword
  const canSubmit =
    !submitting && evaluation.isValid && passwordsMatch

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const pwdErr = validateStrongPassword(newPassword)
    if (pwdErr) {
      setError(pwdErr)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const res = await completePasswordRecoveryReset({
        newPassword,
        confirmPassword,
      })
      if (!res.ok) {
        setError(res.error || 'Unable to update password. Please try again.')
        return
      }
      setUpdated(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unexpected error while updating password. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper pb-20 pt-24 text-ink sm:pt-28">
      <div className="mx-auto max-w-md px-4 sm:px-5">
        <div className="rounded-xl border border-ink/12 bg-paper-2/75 p-6 shadow-sm sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-ochre/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-ochre">
            <KeyRound size={14} />
            Secure Password Reset
          </div>

          {checking ? (
            <div className="py-12 text-center">
              <Loader2 size={24} className="mx-auto animate-spin text-ochre" />
              <p className="mt-3 text-sm text-stone">
                Verifying your password recovery link…
              </p>
            </div>
          ) : updated ? (
            <div className="mt-5 space-y-5">
              <div
                role="status"
                className="flex items-start gap-3 rounded-lg border border-moss/35 bg-moss-light p-4 text-sm text-moss"
              >
                <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    Your password has been updated successfully.
                  </p>
                  <p className="mt-1 text-xs opacity-90">
                    Redirecting you to the Sign In page so you can sign in securely with your new password…
                  </p>
                </div>
              </div>

              <Link
                to="/login"
                search={{ reset: 'success' } as unknown as undefined}
                className="btn-primary w-full justify-center"
              >
                Continue to Sign In
              </Link>
            </div>
          ) : !validRecovery ? (
            <div className="mt-5 space-y-5">
              <h1 className="font-display text-2xl font-semibold text-ink">
                Reset Link Invalid or Expired
              </h1>
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-xs leading-relaxed text-danger"
              >
                <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                <span>
                  {invalidReason} Recovery links are single-use and expire shortly after issue. Please request a new password reset link.
                </span>
              </div>

              <div className="space-y-3 pt-1">
                <Link
                  to="/login"
                  search={{ mode: 'forgot' } as unknown as undefined}
                  className="btn-primary w-full justify-center"
                >
                  Request a New Reset Link
                </Link>
                <Link
                  to="/login"
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 text-sm font-semibold text-ochre hover:underline"
                >
                  <ArrowLeft size={15} />
                  Back to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <>
              <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
                Create New Password
              </h1>
              <p className="mt-1.5 text-sm text-stone">
                Choose a strong new password to secure your MineConnect account.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-5 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-xs font-medium text-danger"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
                <div>
                  <label htmlFor="new-password" className="label">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
                    />
                    <input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="8–64 chars (A-Z, a-z, 0-9, !@#$)"
                      className="field !pl-10 !pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      aria-label={
                        showNewPassword ? 'Hide new password' : 'Show new password'
                      }
                      className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-stone transition hover:text-ink"
                    >
                      {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  <PasswordStrengthChecklist
                    password={newPassword}
                    confirmPassword={confirmPassword}
                  />
                </div>

                <div>
                  <label htmlFor="confirm-new-password" className="label">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
                    />
                    <input
                      id="confirm-new-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="field !pl-10 !pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={
                        showConfirmPassword
                          ? 'Hide confirm password'
                          : 'Show confirm password'
                      }
                      className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-stone transition hover:text-ink"
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={17} />
                      ) : (
                        <Eye size={17} />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="btn-primary mt-2 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
