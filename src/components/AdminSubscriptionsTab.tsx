'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  CreditCard,
  Crown,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react'
import {
  adminReviewSubscriptionPayment,
  adminUpdateSubscriptionPlan,
} from '../lib/subscriptions'
import type {
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
  warning?: string | null
  onRefresh: () => Promise<void>
  onFeedback: (fb: { type: 'success' | 'error'; message: string }) => void
}

export default function AdminSubscriptionsTab({
  plans,
  payments,
  subscriptions,
  warning,
  onRefresh,
  onFeedback,
}: AdminSubscriptionsTabProps) {
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'pending_verification' | 'approved' | 'rejected'
  >('ALL')
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

  const filteredPayments = payments.filter((p) => {
    if (statusFilter === 'ALL') return true
    if (statusFilter === 'approved') {
      return p.status === 'approved' || p.status === 'settled'
    }
    return p.status === statusFilter
  })

  const pendingCount = payments.filter(
    (p) => p.status === 'pending_verification',
  ).length

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
          <strong>Billing Migration Note:</strong> {warning} — apply{' '}
          <code className="font-mono">
            supabase/migrations/20261124000001_subscription_entitlements_billing.sql
          </code>{' '}
          in Supabase SQL Editor to enable full server-side billing persistence.
        </div>
      )}

      {/* 1. Pending & Historical Subscription Payments Verification Queue */}
      <section className="rounded-2xl border border-ink/12 bg-white/90 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard size={18} className="text-ochre" />
              <h2 className="font-display text-2xl font-semibold text-ink">
                Subscription Payment Verification Queue
              </h2>
              {pendingCount > 0 && (
                <span className="rounded-full bg-ochre px-2.5 py-0.5 font-mono text-[10px] font-bold text-paper">
                  {pendingCount} Pending
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-stone">
              Approve Mobile Money or NMB/CRDB EFT transfers to atomically set{' '}
              <code className="font-mono">starts_at = now()</code> and{' '}
              <code className="font-mono">expires_at = now() + 30 days</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['ALL', 'All'],
                ['pending_verification', 'Pending'],
                ['approved', 'Approved'],
                ['rejected', 'Rejected'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setStatusFilter(val)}
                className={`rounded-lg border px-3 py-1.5 font-mono text-[11px] font-semibold transition ${
                  statusFilter === val
                    ? 'border-ink bg-ink text-gold'
                    : 'border-ink/15 bg-paper text-stone hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="inline-flex items-center gap-1 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 font-mono text-[11px] text-ink hover:border-ochre"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="py-10 text-center text-sm text-stone">
            No subscription payment submissions match this filter yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {filteredPayments.map((pay) => {
              const isPending = pay.status === 'pending_verification'
              return (
                <article
                  key={pay.id}
                  className="rounded-xl border border-ink/12 bg-paper/65 p-4"
                >
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-gold">
                          {pay.plan_id}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                            pay.status === 'approved' || pay.status === 'settled'
                              ? 'border-moss/40 bg-moss-light text-moss'
                              : pay.status === 'rejected' || pay.status === 'failed'
                                ? 'border-danger/40 bg-danger/15 text-danger'
                                : 'border-gold/50 bg-gold/20 text-ochre'
                          }`}
                        >
                          {pay.status.replace('_', ' ')}
                        </span>
                        <span className="font-mono text-xs font-bold text-ink tabular-nums">
                          {pay.currency} {Number(pay.amount).toLocaleString('en-US')}
                        </span>
                        <span className="font-mono text-[11px] text-stone">
                          Ref: <strong className="text-ink">{pay.reference_code}</strong>
                        </span>
                      </div>

                      <div className="text-xs text-stone">
                        <strong className="text-ink">
                          {pay.user_name || 'Member'}
                        </strong>{' '}
                        ({pay.user_email || pay.user_id.slice(0, 8)}) ·{' '}
                        {pay.payment_method} ·{' '}
                        {new Date(pay.created_at).toLocaleString()}
                      </div>

                      {pay.notes && (
                        <p className="text-xs italic text-ink/75">
                          Note: {pay.notes}
                        </p>
                      )}

                      {pay.receipt_url && (
                        <a
                          href={pay.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-ochre underline"
                        >
                          Inspect Receipt <ExternalLink size={11} />
                        </a>
                      )}
                    </div>

                    {isPending && (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          type="text"
                          value={notesMap[pay.id] ?? ''}
                          onChange={(e) =>
                            setNotesMap((m) => ({
                              ...m,
                              [pay.id]: e.target.value,
                            }))
                          }
                          placeholder="Verification note (optional)"
                          className="field !py-1.5 !text-xs sm:w-48"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busyId === pay.id}
                            onClick={() => void handleReviewPayment(pay, 'approved')}
                            className="inline-flex items-center gap-1 rounded-lg bg-moss px-3 py-2 font-mono text-[11px] font-semibold text-paper transition hover:opacity-90 disabled:opacity-50"
                          >
                            <CheckCircle2 size={13} /> Approve &amp; Activate
                          </button>
                          <button
                            type="button"
                            disabled={busyId === pay.id}
                            onClick={() => void handleReviewPayment(pay, 'rejected')}
                            className="inline-flex items-center gap-1 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-[11px] font-semibold text-danger transition hover:bg-danger hover:text-paper disabled:opacity-50"
                          >
                            <XCircle size={13} /> Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* 2. Plan Pricing & Entitlement Limits Governance */}
      <section className="rounded-2xl border border-ink/12 bg-white/90 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={17} className="text-ochre" />
              <h2 className="font-display text-2xl font-semibold text-ink">
                Subscription Plans &amp; Limits (`public.subscription_plans`)
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-stone">
              Edit TZS/USD pricing, listing quotas, monthly RFQ limits (-1 = unlimited), and Data Room/Export flags.
            </p>
          </div>
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

      {/* 3. Active Subscriber Directory */}
      <section className="rounded-2xl border border-ink/12 bg-white/90 p-5 sm:p-6">
        <div className="flex items-center gap-2 border-b border-ink/10 pb-3">
          <Crown size={17} className="text-ochre" />
          <h2 className="font-display text-xl font-semibold text-ink">
            Active &amp; Historical User Subscriptions ({subscriptions.length})
          </h2>
        </div>

        {subscriptions.length === 0 ? (
          <p className="py-6 text-center text-xs text-stone">
            No user subscription records stored yet (users default to Explorer until upgraded).
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-ink/10 font-mono text-[10px] uppercase tracking-wider text-stone">
                  <th className="py-2.5 pr-4">Member</th>
                  <th className="py-2.5 pr-4">Plan</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4">Reference</th>
                  <th className="py-2.5">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/8 font-mono">
                {subscriptions.map((sub) => {
                  const expired =
                    new Date(sub.expires_at).getTime() <= Date.now()
                  return (
                    <tr key={sub.id}>
                      <td className="py-2.5 pr-4 font-sans">
                        <div className="font-medium text-ink">
                          {sub.user_name || 'Member'}
                        </div>
                        <div className="text-[11px] text-stone">
                          {sub.user_email || sub.user_id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 font-bold text-ochre uppercase">
                        {sub.plan_id || sub.tier_name}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            sub.status === 'active' && !expired
                              ? 'bg-moss-light text-moss'
                              : 'bg-danger/15 text-danger'
                          }`}
                        >
                          {expired && sub.status === 'active'
                            ? 'expired'
                            : sub.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-stone">
                        {sub.payment_reference || '—'}
                      </td>
                      <td className="py-2.5 text-ink tabular-nums">
                        {new Date(sub.expires_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
