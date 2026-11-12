'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PriceDisplay from '@/components/PriceDisplay';
import type {
  ContentStatus,
  UnifiedContentRecord,
  UnifiedContentType,
} from '@/types/database';

function statusBadgeStyle(status: ContentStatus): string {
  switch (status) {
    case 'active':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    case 'pending':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
    case 'flagged':
    case 'rejected':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400';
    default:
      return 'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400';
  }
}

export default function ContentExplorerClient({
  initialRecords,
}: {
  initialRecords: UnifiedContentRecord[];
}) {
  const router = useRouter();
  const [records, setRecords] =
    useState<UnifiedContentRecord[]>(initialRecords);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | UnifiedContentType>(
    'ALL'
  );
  const [statusFilter, setStatusFilter] = useState<'ALL' | ContentStatus>(
    'ALL'
  );
  const [dateFilter, setDateFilter] = useState('');
  const [selectedRecord, setSelectedRecord] =
    useState<UnifiedContentRecord | null>(null);
  const [editingRecord, setEditingRecord] =
    useState<UnifiedContentRecord | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editStatus, setEditStatus] = useState<ContentStatus>('active');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((item) => {
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (dateFilter && !item.created_at.startsWith(dateFilter)) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.details.toLowerCase().includes(q) ||
        item.owner_email.toLowerCase().includes(q) ||
        item.user_id.toLowerCase().includes(q) ||
        item.reference_code.toLowerCase().includes(q)
      );
    });
  }, [records, searchQuery, typeFilter, statusFilter, dateFilter]);

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRecord) return;
    setBusyId(editingRecord.id);
    try {
      const res = await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRecord.id,
          type: editingRecord.type,
          title: editTitle,
          details: editDetails,
          status: editStatus,
        }),
      });
      if (res.ok) {
        setRecords((prev) =>
          prev.map((r) =>
            r.id === editingRecord.id
              ? {
                  ...r,
                  title: editTitle,
                  details: editDetails,
                  status: editStatus,
                }
              : r
          )
        );
        setFeedback(`Updated record "${editTitle}" and logged audit event.`);
        setEditingRecord(null);
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handlePurge(record: UnifiedContentRecord) {
    if (
      !window.confirm(
        `Permanently purge ${record.type} "${record.title}"? This action is logged in public.audit_logs.`
      )
    ) {
      return;
    }
    setBusyId(record.id);
    try {
      const res = await fetch(
        `/api/admin/content?id=${encodeURIComponent(
          record.id
        )}&type=${encodeURIComponent(record.type)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== record.id));
        setFeedback(`Purged ${record.type} "${record.title}".`);
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
          Complete Content &amp; Uploaded Details Explorer (`/admin/content`)
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Global administrative visibility across all user-uploaded documents, listed mining projects, and service quote requests.
        </p>
      </div>

      {feedback && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-600 dark:text-emerald-300">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)}>
            ✕
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:grid-cols-4">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search title, owner email, UUID, reference..."
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as 'ALL' | UnifiedContentType)
          }
          aria-label="Filter by content type"
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="ALL">All Content Types ({records.length})</option>
          <option value="PROJECT">Mining Projects</option>
          <option value="DOCUMENT">Grounded Documents</option>
          <option value="QUOTE">Service Quotes</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as 'ALL' | ContentStatus)
          }
          aria-label="Filter by status"
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="ALL">All Statuses</option>
          <option value="active">Active / Verified</option>
          <option value="pending">Pending Review</option>
          <option value="flagged">Flagged</option>
          <option value="archived">Archived</option>
          <option value="rejected">Rejected</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          aria-label="Filter by creation date"
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
      </div>

      {/* Data Grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/70 uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Type &amp; Ref</th>
              <th className="px-4 py-3">Title &amp; Metadata</th>
              <th className="px-4 py-3">Owner / User ID</th>
              <th className="px-4 py-3">Valuation</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Direct Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredRecords.map((item) => (
              <tr
                key={`${item.type}-${item.id}`}
                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
              >
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="rounded bg-indigo-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-indigo-500">
                    {item.type}
                  </span>
                  <div className="mt-1 font-mono text-[10px] text-slate-400">
                    {item.reference_code}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {item.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {item.category_badge}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800 dark:text-slate-200">
                    {item.owner_email}
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {item.user_id}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                  {item.value_usd !== null ? (
                    <PriceDisplay amountInUSD={item.value_usd} />
                  ) : (
                    <span className="text-slate-400">N/A</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`inline-flex rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${statusBadgeStyle(
                      item.status
                    )}`}
                  >
                    {item.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-500">
                  {new Date(item.created_at).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedRecord(item)}
                      className="rounded border border-slate-300 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRecord(item);
                        setEditTitle(item.title);
                        setEditDetails(item.details);
                        setEditStatus(item.status);
                      }}
                      className="rounded border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-500"
                    >
                      Edit Metadata
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void handlePurge(item)}
                      className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-500"
                    >
                      Purge
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-indigo-400">
                {selectedRecord.type} · {selectedRecord.reference_code}
              </span>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <h3 className="mt-2 text-lg font-bold">{selectedRecord.title}</h3>
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-950 p-4 text-xs text-slate-300">
              {selectedRecord.details}
            </p>
            <div className="mt-4 space-y-1 font-mono text-[11px] text-slate-400">
              <div>Owner: {selectedRecord.owner_email}</div>
              <div>UUID: {selectedRecord.user_id}</div>
              <div>Status: {selectedRecord.status.toUpperCase()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-lg space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                Edit Record Metadata ({editingRecord.reference_code})
              </h3>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Title
              </label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as ContentStatus)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                <option value="active">Active / Verified</option>
                <option value="pending">Pending</option>
                <option value="flagged">Flagged</option>
                <option value="archived">Archived</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                Details / Content Payload
              </label>
              <textarea
                rows={4}
                required
                value={editDetails}
                onChange={(e) => setEditDetails(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
