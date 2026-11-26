import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from 'lucide-react'
import { Logo } from '../components/Header'
import TurnstileWidget, {
  isTurnstileEnabled,
  type TurnstileWidgetHandle,
} from '../components/TurnstileWidget'
import {
  requestPasswordResetEmail,
  signInWithEmail,
  useAuthState,
} from '../lib/supabaseAuth'
import { formatSafeUserError } from '../lib/verifyTurnstileClient'

const RESET_COOLDOWN_KEY = 'mineconnect_pwd_reset_cooldown_until'
const RESET_COOLDOWN_SECONDS = 60

function readRemainingCooldownSeconds(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.sessionStorage.getItem(RESET_COOLDOWN_KEY)
    if (!raw) return 0
    const until = Number(raw)
    if (!Number.isFinite(until)) return 0
    return Math.max(0, Math.ceil((until - Date.now()) / 1000))
  } catch {
    return 0
  }
}

function writeCooldownWindow(seconds: number): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(
      RESET_COOLDOWN_KEY,
      String(Date.now() + seconds * 1000)
    )
  } catch {
    // ignore storage errors
  }
}

export const Route = createFileRoute('/login')({
  validateSearch: (
    s: Record<string, unknown>
  ): { next?: string; reason?: string; mode?: 'signin' | 'forgot'; reset?: string } => ({
    next: typeof s.next === 'string' && s.next.startsWith('/') ? s.next : undefined,
    reason: typeof s.reason === 'string' ? s.reason : undefined,
    mode: s.mode === 'forgot' ? 'forgot' : undefined,
    reset: typeof s.reset === 'string' ? s.reset : undefined,
  }),
  component: LoginRouteComponent,
})

function LoginRouteComponent() {
  const navigate = useNavigate()
  const { session, passwordRecovery, loading: authLoading, configured } = useAuthState()
  const { next, reason, mode: initialMode, reset } = Route.useSearch()

  const [mode, setMode] = useState<'signin' | 'forgot'>(
    initialMode === 'forgot' ? 'forgot' : 'signin'
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null)
  const turnstileEnabled = isTurnstileEnabled()

  const triggerTurnstileReset = () => {
    setCaptchaToken('')
    if (turnstileRef.current) {
      turnstileRef.current.reset()
    } else {
      setTurnstileResetKey((k) => k + 1)
    }
  }

  // Forgot-password state + 60s anti-abuse cooldown
  const [resetSending, setResetSending] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(() =>
    readRemainingCooldownSeconds()
  )

  const targetDestination =
    next && next !== '/login' && next !== '/signup' ? next : '/dashboard'

  useEffect(() => {
    if (initialMode === 'forgot') {
      setMode('forgot')
      setCaptchaToken('')
      turnstileRef.current?.reset()
    }
  }, [initialMode])

  useEffect(() => {
    if (!authLoading && session && !passwordRecovery) {
      navigate({ to: targetDestination as '/dashboard' })
    }
  }, [authLoading, session, passwordRecovery, navigate, targetDestination])

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = window.setInterval(() => {
      setCooldownSeconds(readRemainingCooldownSeconds())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldownSeconds])

  const isSubmitDisabled =
    submitting || !email.trim() || !password || (turnstileEnabled && !captchaToken)

  const isResetSubmitDisabled =
    resetSending ||
    !email.trim() ||
    cooldownSeconds > 0 ||
    (turnstileEnabled && !captchaToken)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Please enter both your email address and password.')
      return
    }

    if (turnstileEnabled && !captchaToken) {
      setError('Please complete the security verification check before logging in.')
      return
    }

    setSubmitting(true)
    let shouldResetCaptcha = false
    try {
      const res = await signInWithEmail({
        email,
        password,
        ...(captchaToken ? { captchaToken } : {}),
      })
      if (res.error) {
        setError(formatSafeUserError(res.error, 'Invalid email or password. Please try again.'))
        shouldResetCaptcha = true
      } else {
        navigate({ to: targetDestination as '/dashboard' })
      }
    } catch (err) {
      setError(
        formatSafeUserError(
          err instanceof Error ? err.message : undefined,
          'Unexpected sign-in error. Please try again.'
        )
      )
      shouldResetCaptcha = true
    } finally {
      setSubmitting(false)
      if (shouldResetCaptcha) {
        triggerTurnstileReset()
      }
    }
  }

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    if (cooldownSeconds > 0) {
      return
    }

    if (turnstileEnabled && !captchaToken) {
      setError('Please complete the security verification check before requesting a reset link.')
      return
    }

    setResetSending(true)
    try {
      const res = await requestPasswordResetEmail(
        trimmedEmail,
        captchaToken || undefined
      )
      if (!res.ok && res.error) {
        setError(formatSafeUserError(res.error, 'Unable to send reset link. Please try again.'))
        return
      }
      setResetSent(true)
      writeCooldownWindow(RESET_COOLDOWN_SECONDS)
      setCooldownSeconds(RESET_COOLDOWN_SECONDS)
    } catch {
      // Security-safe neutral state even on unexpected transient failures
      setResetSent(true)
      writeCooldownWindow(RESET_COOLDOWN_SECONDS)
      setCooldownSeconds(RESET_COOLDOWN_SECONDS)
    } finally {
      setResetSending(false)
      triggerTurnstileReset()
    }
  }

  const switchToForgot = () => {
    setError(null)
    setResetSent(false)
    triggerTurnstileReset()
    setCooldownSeconds(readRemainingCooldownSeconds())
    setMode('forgot')
  }

  const switchToSignIn = () => {
    setError(null)
    triggerTurnstileReset()
    setMode('signin')
  }

  const reasonBanner =
    reason === 'admin_auth_required'
      ? 'Administrative Clearance Required: Sign in with a verified MineConnect administrator account.'
      : reason === 'list_project'
        ? 'Mandatory Membership: You must be signed in as a verified member to list a mining project.'
        : reason === 'request_quote'
          ? 'Mandatory Membership: Please sign in to request a formal service quote.'
          : reason === 'membership_required'
            ? 'Mandatory Membership: Please sign in or create a free member account to access this section.'
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

          {mode === 'signin' ? (
            <>
              <h1 className="font-display text-3xl font-semibold text-ink">
                Login
              </h1>
              <p className="mt-1.5 text-sm text-stone">
                Access your MineConnect investor &amp; operator workspace.
              </p>

              {reset === 'success' && (
                <div
                  role="status"
                  className="mt-4 flex items-start gap-2.5 rounded-lg border border-moss/35 bg-moss-light p-3.5 text-xs font-medium text-moss"
                >
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>
                    Your password has been updated successfully. Log in below with your new password.
                  </span>
                </div>
              )}

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
                  Supabase environment variables are not configured. Login requires an active Supabase connection.
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
                <div>
                  <label htmlFor="login-email" className="label">
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
                    />
                    <input
                      id="login-email"
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
                  <label htmlFor="login-password" className="label">
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
                    />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
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
                  <div className="mt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={switchToForgot}
                      className="inline-flex min-h-[44px] items-center px-1 text-xs font-semibold text-ochre transition-colors hover:text-ochre-dark hover:underline"
                    >
                      Forgot password
                    </button>
                  </div>
                </div>

                {turnstileEnabled && (
                  <TurnstileWidget
                    key="turnstile-login"
                    ref={turnstileRef}
                    resetKey={turnstileResetKey}
                    timeoutMs={20000}
                    theme="light"
                    action="login"
                    onVerify={(token) => {
                      setCaptchaToken(token)
                      setError(null)
                    }}
                    onExpire={() => setCaptchaToken('')}
                    onError={(msg) => {
                      setCaptchaToken('')
                      if (msg) setError(msg)
                    }}
                  />
                )}

                <button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    'Log in'
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-stone">
                Don&apos;t have an account yet?{' '}
                <Link
                  to="/signup"
                  search={{ next, reason } as unknown as undefined}
                  className="font-semibold text-ochre hover:text-ochre-dark hover:underline"
                >
                  Create an account
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl font-semibold text-ink">
                Reset Your Password
              </h1>
              <p className="mt-1.5 text-sm text-stone">
                Enter your email address and we will send a single-use password recovery link.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-5 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-xs font-medium text-danger"
                >
                  {error}
                </div>
              )}

              {resetSent && (
                <div
                  role="status"
                  className="mt-5 flex items-start gap-2.5 rounded-lg border border-moss/35 bg-moss-light p-4 text-xs leading-relaxed text-moss"
                >
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>
                    If an account exists for that email address, a secure password reset link has been sent. Please check your inbox and spam folder.
                  </span>
                </div>
              )}

              <form onSubmit={handleRequestReset} className="mt-6 space-y-5" noValidate>
                <div>
                  <label htmlFor="reset-email" className="label">
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
                    />
                    <input
                      id="reset-email"
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

                {turnstileEnabled && (
                  <TurnstileWidget
                    key="turnstile-forgot"
                    ref={turnstileRef}
                    resetKey={turnstileResetKey}
                    timeoutMs={20000}
                    theme="light"
                    action="forgot-password"
                    onVerify={(token) => {
                      setCaptchaToken(token)
                      setError(null)
                    }}
                    onExpire={() => setCaptchaToken('')}
                    onError={(msg) => {
                      setCaptchaToken('')
                      if (msg) setError(msg)
                    }}
                  />
                )}

                <button
                  type="submit"
                  disabled={isResetSubmitDisabled}
                  className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resetSending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Sending reset link...
                    </>
                  ) : cooldownSeconds > 0 ? (
                    `Resend available in ${cooldownSeconds}s`
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>

              <div className="mt-6 border-t border-ink/10 pt-5 text-center">
                <button
                  type="button"
                  onClick={switchToSignIn}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 text-sm font-semibold text-ochre transition hover:text-ochre-dark hover:underline"
                >
                  <ArrowLeft size={15} />
                  Back to Login
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
