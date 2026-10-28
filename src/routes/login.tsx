import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Lock, Mail, ShieldCheck } from 'lucide-react'
import { getSession, signInWithEmail } from '../lib/supabaseAuth'

export const Route = createFileRoute('/login')({
  component: LoginRouteComponent,
})

function LoginRouteComponent() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      const res = await signInWithEmail({ email, password })
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
          <div className="inline-flex items-center gap-2 rounded-full bg-ochre/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-ochre">
            <ShieldCheck size={14} />
            RLS-Grounded Portal
          </div>

          <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
            Sign in to MineConnect
          </h1>
          <p className="mt-1.5 text-sm text-stone">
            Access your private investor &amp; operator due-diligence vault.
          </p>

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
                Work Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
                />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@miningcorp.co.tz"
                  className="field !pl-10"
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
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="field !pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full disabled:opacity-50"
            >
              {submitting ? 'Verifying session...' : 'Sign In to Workspace'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-stone">
            New to MineConnect?{' '}
            <Link
              to="/signup"
              className="font-semibold text-ochre hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
