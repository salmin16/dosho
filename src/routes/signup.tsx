import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AlertTriangle, Coins, Lock, Mail, ShieldCheck, User } from 'lucide-react'
import { getSession, signUpWithEmail } from '../lib/supabaseAuth'
import { CURRENCY_LIST, useCurrency } from '../lib/currency'
import type { SupportedCurrency } from '../types/database'

export const Route = createFileRoute('/signup')({
  validateSearch: (s: Record<string, unknown>): { next?: string; reason?: string } => ({
    next: typeof s.next === 'string' && s.next.startsWith('/') ? s.next : undefined,
    reason: typeof s.reason === 'string' ? s.reason : undefined,
  }),
  component: SignUpRouteComponent,
})

function SignUpRouteComponent() {
  const navigate = useNavigate()
  const { next, reason } = Route.useSearch()
  const { currency, setCurrency } = useCurrency()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const targetDestination = next && next !== '/login' && next !== '/signup' ? next : '/dashboard'

  useEffect(() => {
    if (getSession()) {
      navigate({ to: targetDestination as '/dashboard' })
    }
  }, [navigate, targetDestination])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await signUpWithEmail({
        fullName,
        email,
        password,
        confirmPassword,
        preferredCurrency: currency,
      })
      if (res.error) {
        setError(res.error)
      } else {
        navigate({ to: targetDestination as '/dashboard' })
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
    <div className="min-h-screen bg-paper pb-20 pt-28 text-ink">
      <div className="mx-auto max-w-md px-5">
        <div className="rounded-xl border border-ink/10 bg-paper-2/70 p-8 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full bg-moss/15 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-moss">
            <ShieldCheck size={14} />
            PostgreSQL RLS Provisioning
          </div>

          <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
            Create your account
          </h1>
          <p className="mt-1.5 text-sm text-stone">
            Provision an isolated due-diligence vault bound to your UUID.
          </p>

          {reasonBanner && (
            <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-ochre/30 bg-ochre/10 p-3.5 text-xs font-medium text-ink">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-ochre" />
              <span>{reasonBanner}</span>
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
              <label htmlFor="signup-currency" className="label">
                Preferred Global Display Currency
              </label>
              <div className="relative">
                <Coins
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
                />
                <select
                  id="signup-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
                  className="field !pl-10"
                >
                  {CURRENCY_LIST.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code} — {c.name} ({c.symbol.trim()})
                    </option>
                  ))}
                </select>
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
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars (A-Z, a-z, 0-9)"
                  className="field !pl-10"
                />
              </div>
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
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="field !pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary mt-2 w-full disabled:opacity-50"
            >
              {submitting ? 'Provisioning Vault...' : 'Create Grounded Account'}
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
