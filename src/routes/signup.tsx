import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, User } from 'lucide-react'
import { signUpWithEmail, useAuthState } from '../lib/supabaseAuth'
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
  const [captchaTimedOut, setCaptchaTimedOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null)
  const turnstileEnabled = isTurnstileEnabled()

  // Non-blocking submit: only disabled while Supabase request is in flight or required fields are empty
  const isSubmitDisabled =
    submitting || !email.trim() || !password || !confirmPassword

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

    setSubmitting(true)
    try {
      // Only pass captchaToken when Turnstile actually returned a valid token (fail-open on timeout/blocker)
      const res = await signUpWithEmail({
        fullName: validation.data.fullName,
        email: validation.data.email,
        password: validation.data.password,
        confirmPassword,
        ...(captchaToken ? { captchaToken } : {}),
      })
      if (res.confirmationRequired) {
        setNotice(
          res.error ||
            'Account created! Please check your email inbox to confirm your address, then sign in.'
        )
        setPassword('')
        setConfirmPassword('')
        setCaptchaToken('')
        if (!captchaTimedOut) {
          turnstileRef.current?.reset()
        }
      } else if (res.error) {
        setError(res.error)
        setCaptchaToken('')
        if (!captchaTimedOut) {
          turnstileRef.current?.reset()
        }
      } else {
        navigate({ to: targetDestination as '/dashboard' })
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unexpected sign-up error. Please try again.'
      )
      setCaptchaToken('')
      if (!captchaTimedOut) {
        turnstileRef.current?.reset()
      }
    } finally {
      setSubmitting(false)
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
    <div className="min-h-screen bg-paper pb-20 pt-24 text-ink sm:pt-28">
      <div className="mx-auto max-w-md px-4 sm:px-5">
        <div className="rounded-xl border border-ink/10 bg-paper-2/70 p-6 shadow-sm sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-moss/15 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-moss">
            <ShieldCheck size={14} />
            Verified Member Portal
          </div>

          <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
            Create your account
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

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
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
                  placeholder="Salmin Mwenesi — Geita Holdings"
                  className="field !pl-10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-email" className="label">
                Work Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
                />
                <input
                  id="signup-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@miningcorp.co.tz"
                  className="field !pl-10"
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
                  placeholder="8–64 chars (A-Z, a-z, 0-9, !@#$)"
                  className="field !pl-10 !pr-12"
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
                  placeholder="Re-enter your strong password"
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
                  {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {turnstileEnabled && !captchaTimedOut && (
              <div className="pt-1">
                <TurnstileWidget
                  ref={turnstileRef}
                  theme="light"
                  timeoutMs={3000}
                  onVerify={(token) => {
                    setCaptchaToken(token)
                    setError(null)
                  }}
                  onExpire={() => setCaptchaToken('')}
                  onTimeout={() => setCaptchaTimedOut(true)}
                  onError={() => setCaptchaTimedOut(true)}
                />
              </div>
            )}

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
                'Create Grounded Account'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone">
            Already registered?{' '}
            <Link
              to="/login"
              search={{ next, reason } as unknown as undefined}
              className="font-semibold text-ochre hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
