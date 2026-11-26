import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react'
import { Logo } from '../components/Header'
import { signUpWithEmail, useAuthState } from '../lib/supabaseAuth'
import {
  formatSafeUserError,
  verifyTurnstileForAuth,
} from '../lib/verifyTurnstileClient'
import { validateSignUpPayload } from '../lib/validations/auth'
import PasswordStrengthChecklist from '../components/PasswordStrengthChecklist'
import TurnstileWidget, {
  isTurnstileEnabled,
  type TurnstileWidgetHandle,
} from '../components/TurnstileWidget'

export const Route = createFileRoute('/signup')({
  validateSearch: (s: Record<string, unknown>): { next?: string; reason?: string } => ({
    next: typeof s.next === 'string' && s.next.startsWith('/') ? s.next : undefined,
    reason: typeof s.reason === 'string' ? s.reason : undefined,
  }),
  component: SignUpRouteComponent,
})

function SignUpRouteComponent() {
  const navigate = useNavigate()
  const { session, loading: authLoading, configured } = useAuthState()
  const { next, reason } = Route.useSearch()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaFallback, setCaptchaFallback] = useState(false)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null)
  const turnstileEnabled = isTurnstileEnabled()

  // Never lock out Create Account while Turnstile initializes or runs in mobile fallback mode
  const isSubmitDisabled =
    submitting ||
    !email.trim() ||
    !password ||
    !confirmPassword ||
    !acceptedTerms

  const targetDestination = next && next !== '/login' && next !== '/signup' ? next : '/dashboard'

  useEffect(() => {
    if (!authLoading && session) {
      navigate({ to: targetDestination as '/dashboard' })
    }
  }, [authLoading, session, navigate, targetDestination])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const validation = validateSignUpPayload({
      fullName,
      email,
      password,
      confirmPassword,
    })
    if (!validation.success) {
      setError(validation.error)
      return
    }

    if (!acceptedTerms) {
      setError('You must agree to the Mine Connect Terms of Use and Privacy Policy to create an account.')
      return
    }

    setSubmitting(true)
    let shouldResetCaptcha = false
    try {
      if (turnstileEnabled) {
        const verification = await verifyTurnstileForAuth({
          token: captchaToken || undefined,
          fallback: !captchaToken || captchaFallback,
          action: 'signup',
        })
        if (!verification.ok) {
          setError(
            verification.error ||
              'Security verification token was invalid. Please tap Retry and try again.',
          )
          shouldResetCaptcha = Boolean(captchaToken)
          return
        }
      }

      const res = await signUpWithEmail({
        fullName: validation.data.fullName,
        email: validation.data.email,
        password: validation.data.password,
        confirmPassword,
        termsAcceptedAt: new Date().toISOString(),
      })
      if (res.confirmationRequired) {
        setNotice(
          res.error ||
            'Account created! Please check your email inbox to confirm your address, then log in.'
        )
        setPassword('')
        setConfirmPassword('')
        shouldResetCaptcha = Boolean(captchaToken)
      } else if (res.error) {
        setError(formatSafeUserError(res.error, 'Unable to create your account. Please try again.'))
        shouldResetCaptcha = Boolean(captchaToken)
      } else {
        navigate({ to: targetDestination as '/dashboard' })
      }
    } catch (err) {
      setError(
        formatSafeUserError(
          err instanceof Error ? err.message : undefined,
          'Unexpected sign-up error. Please try again.'
        )
      )
      shouldResetCaptcha = Boolean(captchaToken)
    } finally {
      setSubmitting(false)
      if (shouldResetCaptcha) {
        setCaptchaToken('')
        setCaptchaFallback(false)
        if (turnstileRef.current) {
          turnstileRef.current.reset()
        } else {
          setTurnstileResetKey((k) => k + 1)
        }
      }
    }
  }

  const reasonBanner =
    reason === 'list_project'
      ? 'Mandatory Membership Required: Please create a member account or sign in before listing a mining project.'
      : reason === 'request_quote'
        ? 'Mandatory Membership Required: Please create a member account or sign in to request a service quote.'
        : reason === 'membership_required'
          ? 'Mandatory Membership Required: Access to MineConnect marketplace streams, maps, and due-diligence tools requires an authenticated member account.'
          : null

  return (
    <div className="min-h-[100dvh] bg-paper pb-20 pt-24 text-ink sm:pt-28">
      <div className="mx-auto max-w-md px-4 sm:px-5">
        <div className="rounded-xl border border-ink/12 bg-[#FCFBF8] p-6 shadow-sm sm:p-8">
          {/* Crisp Brand-Anchored MineConnect Logo Header */}
          <div className="mb-6 flex items-center justify-center border-b border-ink/10 pb-5">
            <Link to="/" aria-label="MineConnect Home" className="inline-flex">
              <Logo light={false} />
            </Link>
          </div>

          <h1 className="font-display text-3xl font-semibold text-ink">
            Create an account
          </h1>
          <p className="mt-1.5 text-sm text-stone">
            Create your private mining &amp; investment due-diligence workspace.
          </p>

          {reasonBanner && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-ochre/30 bg-ochre/10 p-3.5 text-xs font-medium text-ink">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-ochre" />
              <span>{reasonBanner}</span>
            </div>
          )}

          {!configured && (
            <div
              role="alert"
              className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-xs font-medium text-danger"
            >
              Supabase environment variables (`VITE_SUPABASE_URL` &amp; `VITE_SUPABASE_ANON_KEY`) are not configured. Account creation requires an active Supabase connection.
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mt-5 rounded-md border border-moss/40 bg-moss-light px-4 py-3 text-xs font-medium text-moss"
            >
              {notice}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-xs font-medium text-danger"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            <div className="field-group">
              <label htmlFor="signup-name" className="label">
                Full Name / Organization
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
                />
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name or registered organization"
                  className="field !bg-paper/45 !pl-10 text-base"
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-email" className="label">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
                />
                <input
                  id="signup-email"
                  type="email"
                  inputMode="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@organization.com"
                  className="field !pl-10 text-base"
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-password" className="label">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
                />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password (8–64 chars)"
                  className="field !bg-paper/45 !pl-10 !pr-12 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-stone transition hover:text-ink"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <PasswordStrengthChecklist
                password={password}
                confirmPassword={confirmPassword}
              />
            </div>

            <div>
              <label htmlFor="signup-confirm" className="label">
                Confirm Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
                />
                <input
                  id="signup-confirm"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="field !bg-paper/45 !pl-10 !pr-12 text-base"
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
                  {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {turnstileEnabled && (
              <div className="pt-1">
                <TurnstileWidget
                  ref={turnstileRef}
                  resetKey={turnstileResetKey}
                  timeoutMs={5000}
                  allowMobileFallback
                  fallbackLabel="Basic network check active"
                  theme="light"
                  action="signup"
                  onVerify={(token) => {
                    setCaptchaToken(token)
                    setCaptchaFallback(false)
                    setError(null)
                  }}
                  onExpire={() => {
                    setCaptchaToken('')
                  }}
                  onRetry={() => {
                    setCaptchaToken('')
                    setCaptchaFallback(true)
                    setError(null)
                  }}
                  onFallbackReady={() => {
                    setCaptchaToken('')
                    setCaptchaFallback(true)
                    setError(null)
                  }}
                  onError={(msg) => {
                    setCaptchaToken('')
                    setCaptchaFallback(true)
                    if (msg) setError(null)
                  }}
                />
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink/12 bg-paper/60 p-3 text-xs leading-relaxed text-ink-3">
              <input
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-ochre"
              />
              <span>
                I agree to the Mine Connect{' '}
                <a
                  href="/legal/terms-of-use"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ochre underline hover:text-ochre-dark"
                >
                  Terms of Use
                </a>{' '}
                and{' '}
                <a
                  href="/legal/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ochre underline hover:text-ochre-dark"
                >
                  Privacy Policy
                </a>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="btn-primary mt-2 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create an account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone">
            Already have an account?{' '}
            <Link
              to="/login"
              search={{ next, reason } as unknown as undefined}
              className="font-semibold text-ochre hover:text-ochre-dark hover:underline"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
