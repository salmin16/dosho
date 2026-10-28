import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Lock, Mail, ShieldCheck, User } from 'lucide-react'
import { getSession, signUpWithEmail } from '../lib/supabaseAuth'

export const Route = createFileRoute('/signup')({
  component: SignUpRouteComponent,
})

function SignUpRouteComponent() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (getSession()) {
      navigate({ to: '/dashboard' })
    }
  }, [navigate])

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
      })
      if (res.error) {
        setError(res.error)
      } else {
        navigate({ to: '/dashboard' })
      }
    } finally {
      setSubmitting(false)
    }
  }

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
