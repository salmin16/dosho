'use client'

import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  CreditCard,
  Crown,
  ExternalLink,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Users,
  XCircle,
} from 'lucide-react'
import {
  adminReviewSubscriptionPayment,
  adminUpdateSubscriptionPlan,
} from '../lib/subscriptions'
import type {
  AccountBillingState,
  AdminAccountLedgerRow,
  SubscriptionPaymentRecord,
  SubscriptionPlanId,
  SubscriptionPlanRecord,
  UserSubscriptionRecord,
} from '../types/database'

export interface AdminBillingPaymentRow extends SubscriptionPaymentRecord {
  user_email?: string
  user_name?: string
}

export interface AdminBillingSubRow extends UserSubscriptionRecord {
  user_email?: string
  user_name?: string
}

export interface AdminSubscriptionsTabProps {
  plans: SubscriptionPlanRecord[]
  payments: AdminBillingPaymentRow[]
  subscriptions: AdminBillingSubRow[]
  accountsLedger: AdminAccountLedgerRow[]
  warning?: string | null
  onRefresh: () => Promise<void>
  onFeedback: (fb: { type: 'success' | 'error'; message: string }) => void
}

export default function AdminSubscriptionsTab({
  plans,
  payments,
  accountsLedger,
  warning,
  onRefresh,
  onFeedback,
}: AdminSubscriptionsTabProps) {
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | AccountBillingState>('ALL')
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notesMap, setNotesMap] = useState<Record<string, string>>({})

  // Plan pricing & limits inline editor state
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanRecord | null>(
    null,
  )
  const [editPriceTzs, setEditPriceTzs] = useState('')
  const [editPriceUsd, setEditPriceUsd] = useState('')
  const [editMaxListings, setEditMaxListings] = useState('')
  const [editMaxRfqs, setEditMaxRfqs] = useState('')
  const [editDataRoom, setEditDataRoom] = useState(false)
  const [editExportMarkets, setEditExportMarkets] = useState(false)

  const ledgerCounts = useMemo(() => {
    let active = 0
    let dormant = 0
    let free = 0
    for (const row of accountsLedger) {
      if (row.account_state === 'active') active++
      else if (row.account_state === 'dormant') dormant++
      else free++
    }
    return { all: accountsLedger.length, active, dormant, free }
  }, [accountsLedger])

  const filteredLedger = useMemo(() => {
    const q = ledgerSearch.trim().toLowerCase()
    return accountsLedger.filter((row) => {
      if (ledgerFilter !== 'ALL' && row.account_state !== ledgerFilter) {
        return false
      }
      if (!q) return true
      return (
        row.email.toLowerCase().includes(q) ||
        (row.full_name ?? '').toLowerCase().includes(q) ||
        row.plan_name.toLowerCase().includes(q) ||
        (row.payment_method ?? '').toLowerCase().includes(q)
      )
    })
  }, [accountsLedger, ledgerFilter, ledgerSearch])

  const pendingPayments = useMemo(
    () => payments.filter((p) => p.status === 'pending_verification'),
    [payments],
  )

  const handleReviewPayment = async (
    pay: AdminBillingPaymentRow,
    decision: 'approved' | 'rejected',
  ) => {
    setBusyId(pay.id)
    try {
      const res = await adminReviewSubscriptionPayment({
        paymentId: pay.id,
        decision,
        notes: notesMap[pay.id] || undefined,
      })
      if (!res.ok) {
        onFeedback({
          type: 'error',
          message: res.error || 'Failed to update subscription payment.',
        })
        return
      }
      onFeedback({
        type: 'success',
        message:
          decision === 'approved'
            ? `Approved ${pay.plan_id.toUpperCase()} for ${pay.user_email || pay.user_id.slice(0, 8)} — activated for 30 days.`
            : `Rejected payment reference ${pay.reference_code}.`,
      })
      await onRefresh()
    } finally {
      setBusyId(null)
    }
  }

  const startEditPlan = (p: SubscriptionPlanRecord) => {
    setEditingPlan(p)
    setEditPriceTzs(String(p.price_tzs))
    setEditPriceUsd(String(p.price_usd))
    setEditMaxListings(String(p.max_active_listings))
    setEditMaxRfqs(String(p.max_monthly_rfqs))
    setEditDataRoom(Boolean(p.can_access_data_room))
    setEditExportMarkets(Boolean(p.can_export_markets))
  }

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPlan) return
    setBusyId(editingPlan.id)
    try {
      const res = await adminUpdateSubscriptionPlan(
        editingPlan.id as SubscriptionPlanId,
        {
          price_tzs: Math.max(0, Number(editPriceTzs) || 0),
          price_usd: Math.max(0, Number(editPriceUsd) || 0),
          max_active_listings: Math.trunc(Number(editMaxListings)),
          max_monthly_rfqs: Math.trunc(Number(editMaxRfqs)),
          can_access_data_room: editDataRoom,
          can_export_markets: editExportMarkets,
        },
      )
      if (!res.ok) {
        onFeedback({
          type: 'error',
          message: res.error || 'Could not update subscription plan.',
        })
        return
      }
      onFeedback({
        type: 'success',
        message: `Updated ${editingPlan.name} pricing and entitlement limits.`,
      })
      setEditingPlan(null)
      await onRefresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      {warning && (
        <div className="rounded-xl border border-gold/40 bg-gold/15 px-4 py-3 text-xs text-ink">
          <strong>Billing Notice:</strong> {warning}
        </div>
      )}

      {/* 1. ACCOUNTS LEDGER (Active / Dormant / Free Classification) */}
      <section className="rounded-2xl border border-ink/12 bg-white/95 p-5 shadow-xs sm:p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-4 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Users size={18} className="text-ochre" />
              <h2 className="font-display text-2xl font-semibold text-ink">
                Accounts Billing Ledger
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-stone">
              Authoritative classification of every MineConnect member into{' '}
              <strong className="text-moss">Active</strong> (paid &amp; unexpired),{' '}
              <strong className="text-danger">Dormant</strong> (expired paid plan, reverted to free quotas), and{' '}
              <strong className="text-ink">Free</strong> (Explorer).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 sm:w-56">
              <Search
                size={13}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone"
              />
              <input
                type="search"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Search email or plan..."
                className="h-9 w-full rounded-lg border border-ink/15 bg-paper pl-8 pr-3 text-xs text-ink outline-none focus:border-ochre"
              />
            </div>
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-3 font-mono text-[11px] font-semibold text-ink hover:border-ochre"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {/* Summary KPI Cards + Instant Filter Pills (All | Active | Dormant | Free) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Filter accounts by billing state"
            className="flex flex-wrap items-center gap-2"
          >
            {(
              [
                ['ALL', 'All', ledgerCounts.all],
                ['active', 'Active', ledgerCounts.active],
                ['dormant', 'Dormant', ledgerCounts.dormant],
                ['free', 'Free', ledgerCounts.free],
              ] as const
            ).map(([key, label, count]) => {
              const selected = ledgerFilter === key
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setLedgerFilter(key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold transition ${
                    selected
                      ? 'border-ink bg-ink text-gold shadow-xs'
                      : 'border-ink/15 bg-paper text-stone hover:border-ochre/45 hover:text-ink'
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                      selected
                        ? 'bg-gold/20 text-gold'
                        : 'bg-ink/8 text-ink-3'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Accounts Table */}
        {filteredLedger.length === 0 ? (
          <div className="py-10 text-center text-sm text-stone">
            No member accounts match this billing filter.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead>
                <tr className="border-b border-ink/10 font-mono text-[10px] uppercase tracking-wider text-stone">
                  <th className="py-2.5 pr-4">User Email</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4">Active / Last Plan</th>
                  <th className="py-2.5 pr-4">Payment Method</th>
                  <th className="py-2.5">Expiry Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8">
                {filteredLedger.map((row) => (
                  <tr key={row.user_id} className="hover:bg-paper/60">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-ink">{row.email}</div>
                      {row.full_name && (
                        <div className="text-[11px] text-stone">
                          {row.full_name}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                          row.account_state === 'active'
                            ? 'border-moss/40 bg-moss-light text-moss'
                            : row.account_state === 'dormant'
                              ? 'border-danger/40 bg-danger/10 text-danger'
                              : 'border-ink/15 bg-paper-2 text-stone'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            row.account_state === 'active'
                              ? 'bg-moss'
                              : row.account_state === 'dormant'
                                ? 'bg-danger'
                                : 'bg-stone'
                          }`}
                        />
                        {row.account_state}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono">
                      <div className="font-semibold text-ink">
                        {row.plan_name}
                      </div>
                      {row.payment_reference && (
                        <div className="text-[10px] text-stone">
                          Ref: {row.payment_reference}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-[11px] text-ink-3">
                      {row.payment_method || 'Free Tier'}
                    </td>
                    <td className="py-3 font-mono text-[11px] text-ink tabular-nums">
                      {row.expires_at && row.account_state !== 'free'
                        ? new Date(row.expires_at).toLocaleString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 2. Pending Manual Reviews (Only Shown If Any Legacy Pending Payments Exist) */}
      {pendingPayments.length > 0 && (
        <section className="rounded-2xl border border-ochre/35 bg-white/90 p-5 sm:p-6">
          <div className="flex items-center gap-2 border-b border-ink/10 pb-3">
            <CreditCard size={17} className="text-ochre" />
            <h2 className="font-display text-xl font-semibold text-ink">
              Pending Manual Payment Reviews ({pendingPayments.length})
            </h2>
          </div>
          <div className="mt-4 space-y-3">
            {pendingPayments.map((pay) => (
              <article
                key={pay.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-ink/12 bg-paper/65 p-4 lg:flex-row lg:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    <span className="rounded bg-ink px-2 py-0.5 text-[10px] font-bold uppercase text-gold">
                      {pay.plan_id}
                    </span>
                    <strong className="text-ink tabular-nums">
                      {pay.currency} {Number(pay.amount).toLocaleString('en-US')}
                    </strong>
                    <span className="text-stone">Ref: {pay.reference_code}</span>
                  </div>
                  <div className="text-xs text-stone">
                    {pay.user_email || pay.user_id.slice(0, 8)} · {pay.payment_method}
                  </div>
                  {pay.receipt_url && (
                    <a
                      href={pay.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-ochre underline"
                    >
                      Receipt <ExternalLink size={11} />
                    </a>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={notesMap[pay.id] ?? ''}
                    onChange={(e) =>
                      setNotesMap((m) => ({ ...m, [pay.id]: e.target.value }))
                    }
                    placeholder="Note (optional)"
                    className="field !py-1.5 !text-xs sm:w-44"
                  />
                  <button
                    type="button"
                    disabled={busyId === pay.id}
                    onClick={() => void handleReviewPayment(pay, 'approved')}
                    className="inline-flex items-center gap-1 rounded-lg bg-moss px-3 py-2 font-mono text-[11px] font-semibold text-paper disabled:opacity-50"
                  >
                    <CheckCircle2 size={13} /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === pay.id}
                    onClick={() => void handleReviewPayment(pay, 'rejected')}
                    className="inline-flex items-center gap-1 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-[11px] font-semibold text-danger disabled:opacity-50"
                  >
                    <XCircle size={13} /> Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 3. Plan Pricing & Entitlement Limits Governance */}
      <section className="rounded-2xl border border-ink/12 bg-white/90 p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-ink/10 pb-3">
          <SlidersHorizontal size={17} className="text-ochre" />
          <h2 className="font-display text-xl font-semibold text-ink">
            Subscription Plans &amp; Limits
          </h2>
        </div>

        {editingPlan && (
          <form
            onSubmit={handleSavePlan}
            className="mt-4 grid gap-3 rounded-xl border border-ochre/40 bg-paper p-4 sm:grid-cols-6"
          >
            <div className="sm:col-span-6 font-display text-base font-semibold text-ink">
              Editing Plan: {editingPlan.name} ({editingPlan.id})
            </div>
            <div>
              <label className="label !text-[10px]">Price (TZS)</label>
              <input
                type="number"
                value={editPriceTzs}
                onChange={(e) => setEditPriceTzs(e.target.value)}
                className="field !py-1.5 !text-xs font-mono"
              />
            </div>
            <div>
              <label className="label !text-[10px]">Price (USD)</label>
              <input
                type="number"
                value={editPriceUsd}
                onChange={(e) => setEditPriceUsd(e.target.value)}
                className="field !py-1.5 !text-xs font-mono"
              />
            </div>
            <div>
              <label className="label !text-[10px]">Max Listings (-1=∞)</label>
              <input
                type="number"
                value={editMaxListings}
                onChange={(e) => setEditMaxListings(e.target.value)}
                className="field !py-1.5 !text-xs font-mono"
              />
            </div>
            <div>
              <label className="label !text-[10px]">Max RFQs/Mo (-1=∞)</label>
              <input
                type="number"
                value={editMaxRfqs}
                onChange={(e) => setEditMaxRfqs(e.target.value)}
                className="field !py-1.5 !text-xs font-mono"
              />
            </div>
            <div className="flex flex-col justify-center gap-1.5 pt-3 text-xs">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editDataRoom}
                  onChange={(e) => setEditDataRoom(e.target.checked)}
                  className="accent-ochre"
                />
                Data Room
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={editExportMarkets}
                  onChange={(e) => setEditExportMarkets(e.target.checked)}
                  className="accent-ochre"
                />
                CSV Exports
              </label>
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={busyId === editingPlan.id}
                className="btn-primary !py-2 !px-3.5 text-xs"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="rounded-md border border-ink/20 bg-white px-3 py-2 text-xs text-stone hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-ink/12 bg-paper/60 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-lg font-semibold text-ink">
                  {p.name}
                </span>
                <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-gold">
                  {p.id}
                </span>
              </div>
              <div className="mt-2 space-y-1 font-mono text-xs text-stone tabular-nums">
                <div>
                  Price:{' '}
                  <strong className="text-ink">
                    TSh {Number(p.price_tzs).toLocaleString('en-US')} / US$
                    {Number(p.price_usd).toLocaleString('en-US')}
                  </strong>
                </div>
                <div>
                  Listings:{' '}
                  <strong className="text-ink">
                    {p.max_active_listings < 0 ? 'Unlimited' : p.max_active_listings}
                  </strong>{' '}
                  · RFQs/mo:{' '}
                  <strong className="text-ink">
                    {p.max_monthly_rfqs < 0 ? 'Unlimited' : p.max_monthly_rfqs}
                  </strong>
                </div>
                <div>
                  Data Room:{' '}
                  <strong className="text-ink">
                    {p.can_access_data_room ? 'Yes' : 'No'}
                  </strong>{' '}
                  · Exports:{' '}
                  <strong className="text-ink">
                    {p.can_export_markets ? 'Yes' : 'No'}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => startEditPlan(p)}
                className="mt-3 rounded-md border border-ink/20 bg-white px-3 py-1.5 font-mono text-[11px] font-semibold text-ochre hover:border-ochre"
              >
                Edit Pricing &amp; Limits
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Payment Transaction History Log */}
      <section className="rounded-2xl border border-ink/12 bg-white/90 p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-ink/10 pb-3">
          <Crown size={17} className="text-ochre" />
          <h2 className="font-display text-xl font-semibold text-ink">
            Payment History Log ({payments.length})
          </h2>
        </div>

        {payments.length === 0 ? (
          <p className="py-6 text-center text-xs text-stone">
            No subscription payment transactions logged yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-ink/10 font-mono text-[10px] uppercase tracking-wider text-stone">
                  <th className="py-2 pr-4">User</th>
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Method &amp; Ref</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8 font-mono">
                {payments.map((pay) => (
                  <tr key={pay.id}>
                    <td className="py-2.5 pr-4 font-sans text-ink">
                      {pay.user_email || pay.user_id.slice(0, 8)}
                    </td>
                    <td className="py-2.5 pr-4 font-bold uppercase text-ochre">
                      {pay.plan_id}
                    </td>
                    <td className="py-2.5 pr-4 font-semibold text-ink tabular-nums">
                      {pay.currency} {Number(pay.amount).toLocaleString('en-US')}
                    </td>
                    <td className="py-2.5 pr-4 text-[11px] text-stone">
                      {pay.payment_method} · {pay.reference_code}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          pay.status === 'settled' || pay.status === 'approved'
                            ? 'bg-moss-light text-moss'
                            : pay.status === 'rejected' || pay.status === 'failed'
                              ? 'bg-danger/15 text-danger'
                              : 'bg-gold/25 text-ochre'
                        }`}
                      >
                        {pay.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 text-[11px] text-stone tabular-nums">
                      {new Date(pay.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
