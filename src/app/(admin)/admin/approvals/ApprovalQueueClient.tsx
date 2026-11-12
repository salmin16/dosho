'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import PriceDisplay from '@/components/PriceDisplay';
import type { UnifiedContentRecord } from '@/types/database';

export default function ApprovalQueueClient({
  initialQueue,
}: {
  initialQueue: UnifiedContentRecord[];
}) {
  const router = useRouter();
  const [queue, setQueue] = useState<UnifiedContentRecord[]>(initialQueue);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleModeration(
    item: UnifiedContentRecord,
    decision: 'APPROVE' | 'REJECT'
  ) {
    setBusyId(item.id);
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          type: item.type,
          decision,
          notes: notesById[item.id] ?? '',
        }),
      });
      if (res.ok) {
        setQueue((prev) => prev.filter((q) => q.id !== item.id));
        setFeedback(
          `${decision === 'APPROVE' ? 'Approved' : 'Rejected'} ${item.type} "${
            item.title
          }". Audit log recorded.`
        );
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Moderation &amp; Pending Approval Workflow (`/admin/approvals`)
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Review submissions where `status = &apos;pending&apos;` or `approved = false`. Every approval or rejection updates PostgreSQL and records an immutable audit event.
        </p>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-600 dark:text-emerald-300">
          {feedback}
        </div>
      )}

      {queue.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70">
          All pending submissions have been reviewed and cleared.
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => (
            <article
              key={`${item.type}-${item.id}`}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-500">
                    {item.type} · AWAITING REVIEW
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    {item.reference_code}
                  </span>
                </div>
                {item.value_usd !== null && (
                  <span className="font-mono text-sm font-bold text-indigo-500">
                    <PriceDisplay amountInUSD={item.value_usd} />
                  </span>
                )}
              </div>

              <h2 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                {item.title}
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {item.category_badge} · Submitted by {item.owner_name} (
                {item.owner_email} · UUID: {item.user_id})
              </p>

              <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                {item.details}
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <input
                  type="text"
                  value={notesById[item.id] ?? ''}
                  onChange={(e) =>
                    setNotesById((prev) => ({
                      ...prev,
                      [item.id]: e.target.value,
                    }))
                  }
                  placeholder="Optional compliance review notes or rejection reason..."
                  className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void handleModeration(item, 'APPROVE')}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Approve &amp; Publish
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void handleModeration(item, 'REJECT')}
                    className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-500 transition hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    Reject Submission
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
