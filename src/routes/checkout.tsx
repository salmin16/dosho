import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { normalizePlanId } from '../lib/subscriptions'

interface CheckoutSearch {
  tier?: string
  plan?: string
  billing?: string
}

export const Route = createFileRoute('/checkout')({
  validateSearch: (raw: Record<string, unknown>): CheckoutSearch => ({
    tier: typeof raw.tier === 'string' ? raw.tier : undefined,
    plan: typeof raw.plan === 'string' ? raw.plan : undefined,
    billing: typeof raw.billing === 'string' ? raw.billing : undefined,
  }),
  head: () => ({
    meta: [
      {
        title: 'AzamPay Subscription Checkout — MineConnect',
      },
    ],
  }),
  component: CheckoutRedirectComponent,
})

function CheckoutRedirectComponent() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  useEffect(() => {
    const normalized = normalizePlanId(search.plan ?? search.tier)
    const targetPlan = normalized === 'enterprise' ? 'enterprise' : 'pro'
    void navigate({
      to: '/pricing',
      search: { plan: targetPlan, checkout: '1' } as unknown as undefined,
      replace: true,
    })
  }, [navigate, search.plan, search.tier])

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper pt-[72px] text-ink">
      <p className="font-mono text-xs uppercase tracking-wider text-stone">
        Redirecting to AzamPay Checkout…
      </p>
    </div>
  )
}
