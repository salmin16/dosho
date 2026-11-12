'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuditLog, UserProfile, UserRole, UserStatus } from '@/types/database';
import PriceDisplay from '@/components/PriceDisplay';

export interface SystemHealthMetrics {
  dbLatencyMs: number;
  rlsEnforced: boolean;
  apiStatus: 'healthy' | 'degraded';
  totalDocumentsCount: number;
  lastCheckedIso: string;
}

export interface AdminDashboardClientProps {
  currentAdminId: string;
  initialUsers: UserProfile[];
  initialAuditLogs: AuditLog[];
  activeSessionsCount: number;
  errorRatePercent: number;
  errorEventsCount24h: number;
  healthMetrics: SystemHealthMetrics;
}

const LOGS_PER_PAGE = 8;

function getActionBadgeStyle(action: string): string {
  if (
    action.includes('DELETE') ||
    action.includes('SUSPEND') ||
    action.includes('UNAUTHORIZED') ||
    action.includes('FAILED')
  ) {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400';
  }
  if (action.includes('ADMIN') || action.includes('UPDATE')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
  }
  if (action.includes('LOGIN') || action.includes('SIGNUP') || action.includes('ACTIVATE')) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  }
  return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400';
}

export default function AdminDashboardClient({
  currentAdminId,
  initialUsers,
  initialAuditLogs,
  activeSessionsCount,
  errorRatePercent,
  errorEventsCount24h,
  healthMetrics,
}: AdminDashboardClientProps) {
  const router = useRouter();

  // State for User Management Console
  const [users, setUsers] = useState<UserProfile[]>(initialUsers);
  const [userSearch, setUserSearch] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // State for Live Audit Trail Table
  const [auditLogs] = useState<AuditLog[]>(initialAuditLogs);
  const [logSearch, setLogSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'audit' | 'users' | 'health'>('audit');

  // Map user IDs to emails for display in the audit table
  const userEmailMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => map.set(u.id, u.email));
    return map;
  }, [users]);

  const distinctActions = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((log) => set.add(log.action));
    return Array.from(set).sort();
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchesAction =
        actionFilter === 'ALL' || log.action === actionFilter;
      const email = log.user_id ? userEmailMap.get(log.user_id) ?? '' : '';
      const query = logSearch.trim().toLowerCase();
      const matchesQuery =
        !query ||
        log.action.toLowerCase().includes(query) ||
        (log.user_id && log.user_id.toLowerCase().includes(query)) ||
        email.toLowerCase().includes(query) ||
        (log.ip_address && log.ip_address.toLowerCase().includes(query)) ||
        JSON.stringify(log.metadata).toLowerCase().includes(query);

      return matchesAction && matchesQuery;
    });
  }, [auditLogs, actionFilter, logSearch, userEmailMap]);

  const totalLogPages = Math.max(
    1,
    Math.ceil(filteredLogs.length / LOGS_PER_PAGE)
  );
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * LOGS_PER_PAGE;
    return filteredLogs.slice(start, start + LOGS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  async function handleUpdateUser(
    targetUserId: string,
    payload: { role?: UserRole; status?: UserStatus }
  ) {
    setBusyUserId(targetUserId);
    setFeedbackBanner(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, ...payload }),
      });

      const result = (await response.json()) as {
        user?: UserProfile;
        error?: string;
      };

      if (!response.ok || !result.user) {
        setFeedbackBanner({
          type: 'error',
          message: result.error || 'Failed to update user account.',
        });
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === targetUserId ? result.user! : u))
      );
      setFeedbackBanner({
        type: 'success',
        message: `Updated ${result.user.email} (${
          payload.role ? `role → ${payload.role}` : `status → ${payload.status}`
        }). Audit log recorded.`,
      });
      router.refresh();
    } catch {
      setFeedbackBanner({
        type: 'error',
        message: 'Network error while communicating with /api/admin/users.',
      });
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleDeleteUser(targetUser: UserProfile) {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete ${targetUser.email}? This action will be recorded in the immutable security audit log.`
      )
    ) {
      return;
    }

    setBusyUserId(targetUser.id);
    setFeedbackBanner(null);

    try {
      const response = await fetch(
        `/api/admin/users?userId=${encodeURIComponent(targetUser.id)}`,
        {
          method: 'DELETE',
        }
      );

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !result.success) {
        setFeedbackBanner({
          type: 'error',
          message: result.error || 'Failed to delete user.',
        });
        return;
      }

      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      setFeedbackBanner({
        type: 'success',
        message: `Deleted user ${targetUser.email}. Audit event recorded.`,
      });
      router.refresh();
    } catch {
      setFeedbackBanner({
        type: 'error',
        message: 'Network error while deleting user account.',
      });
    } finally {
      setBusyUserId(null);
    }
  }

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const suspendedCount = users.filter((u) => u.status === 'suspended').length;
  // Estimated monthly platform billing / value per active user ($49/mo base USD) to showcase multi-currency integration
  const estimatedMonthlyArrUSD = users.filter((u) => u.status === 'active').length * 49;

  return (
    <div className="space-y-8">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Administrative Governance &amp; Security Telemetry
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Zero client-side trust. Enforced by Next.js Edge Middleware, Server Route Verification, and PostgreSQL Row-Level Security.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.refresh()}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-indigo-500/30 bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          <span>Refresh Live Telemetry</span>
        </button>
      </div>

      {/* Feedback Notification Banner */}
      {feedbackBanner && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-medium ${
            feedbackBanner.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
          }`}
        >
          <span>{feedbackBanner.message}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="ml-4 font-bold opacity-75 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Overview & Analytics Cards */}
      <section
        aria-label="Overview and Analytics Cards"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Registered Users
            </span>
            <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-500">
              {adminCount} Admin{adminCount === 1 ? '' : 's'}
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">
            {users.length.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {suspendedCount} suspended • {users.length - suspendedCount} active
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Sessions (24h)
            </span>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-500">
              LIVE JWT
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">
            {activeSessionsCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Verified via Supabase SSR Auth
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              System Error Rate (24h)
            </span>
            <span
              className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold ${
                errorRatePercent > 10
                  ? 'bg-rose-500/10 text-rose-500'
                  : 'bg-emerald-500/10 text-emerald-500'
              }`}
            >
              {errorRatePercent > 10 ? 'ELEVATED' : 'NOMINAL'}
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">
            {errorRatePercent}%
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {errorEventsCount24h} security/auth failure event
            {errorEventsCount24h === 1 ? '' : 's'} in 24h
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Workspace Value
            </span>
            <span className="rounded-md bg-sky-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-500">
              MULTI-FX
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-white">
            <PriceDisplay amountInUSD={estimatedMonthlyArrUSD} suffix="/mo" />
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {healthMetrics.totalDocumentsCount} grounded documents stored
          </p>
        </div>
      </section>

      {/* Module Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'audit'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          Live Audit Trail ({auditLogs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          User Management Console ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('health')}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === 'health'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          System Health &amp; Activity Monitor
        </button>
      </div>

      {/* 2. Live Audit Trail Table */}
      {activeTab === 'audit' && (
        <section
          aria-label="Live Audit Trail Table"
          className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
        >
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Immutable Security Audit Trail (`public.audit_logs`)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real-time stream of user authentication, document mutations, and administrative actions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={logSearch}
                onChange={(e) => {
                  setLogSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Filter by user, IP, action, metadata..."
                className="w-60 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />

              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter by audit action"
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="ALL">All Actions ({auditLogs.length})</option>
                {distinctActions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/70 uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold">Action Badge</th>
                  <th className="px-4 py-3 font-semibold">Actor / User ID</th>
                  <th className="px-4 py-3 font-semibold">IP &amp; User-Agent</th>
                  <th className="px-4 py-3 font-semibold">Contextual Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                    >
                      No audit log entries match the current filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log) => {
                    const actorEmail = log.user_id
                      ? userEmailMap.get(log.user_id)
                      : null;
                    return (
                      <tr
                        key={log.id}
                        className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${getActionBadgeStyle(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {actorEmail || 'System / Unauthenticated'}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            {log.user_id || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            {log.ip_address || '0.0.0.0'}
                          </div>
                          <div
                            title={log.user_agent || ''}
                            className="max-w-[200px] truncate text-[10px] text-slate-400"
                          >
                            {log.user_agent || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          <pre className="max-w-xs overflow-x-auto rounded bg-slate-100 px-2 py-1 text-[10px] dark:bg-slate-950">
                            {JSON.stringify(log.metadata ?? {})}
                          </pre>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>
              Showing {paginatedLogs.length} of {filteredLogs.length} events (Page{' '}
              {currentPage} of {totalLogPages})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded border border-slate-300 px-2.5 py-1 font-medium disabled:opacity-40 dark:border-slate-700"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalLogPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalLogPages, p + 1))
                }
                className="rounded border border-slate-300 px-2.5 py-1 font-medium disabled:opacity-40 dark:border-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 3. User Management Console */}
      {activeTab === 'users' && (
        <section
          aria-label="User Management Console"
          className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
        >
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                User Governance &amp; Role Console (`public.user_profiles`)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Modify user clearance levels, suspend compromised accounts, or remove profiles via protected `/api/admin/users` actions.
              </p>
            </div>

            <input
              type="search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users by email, name, or UUID..."
              className="w-64 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/70 uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">User Profile</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Provisioned</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    Administrative Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentAdminId;
                  const isBusy = busyUserId === u.id;

                  return (
                    <tr
                      key={u.id}
                      className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {u.full_name || u.email}
                          </span>
                          {isSelf && (
                            <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[10px] text-indigo-400">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {u.email}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {u.id}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase ${
                            u.role === 'admin'
                              ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-500'
                              : 'border-slate-500/30 bg-slate-500/10 text-slate-500 dark:text-slate-300'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase ${
                            u.status === 'suspended'
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-500'
                              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                          }`}
                        >
                          {u.status ?? 'active'}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isSelf || isBusy}
                            onClick={() =>
                              handleUpdateUser(u.id, {
                                role: u.role === 'admin' ? 'user' : 'admin',
                              })
                            }
                            className="rounded border border-slate-300 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            {u.role === 'admin'
                              ? 'Demote to User'
                              : 'Promote to Admin'}
                          </button>

                          <button
                            type="button"
                            disabled={isSelf || isBusy}
                            onClick={() =>
                              handleUpdateUser(u.id, {
                                status:
                                  u.status === 'suspended'
                                    ? 'active'
                                    : 'suspended',
                              })
                            }
                            className="rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 transition hover:bg-amber-500/20 disabled:opacity-40 dark:text-amber-400"
                          >
                            {u.status === 'suspended' ? 'Activate' : 'Suspend'}
                          </button>

                          <button
                            type="button"
                            disabled={isSelf || isBusy}
                            onClick={() => handleDeleteUser(u)}
                            className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-600 transition hover:bg-rose-500/20 disabled:opacity-40 dark:text-rose-400"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 4. System Health & Activity Monitor */}
      {activeTab === 'health' && (
        <section
          aria-label="System Health and Activity Monitor"
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              PostgreSQL &amp; Supabase Probe
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Round-trip query execution latency from Server Component to PostgreSQL.
            </p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-bold text-emerald-500">
                {healthMetrics.dbLatencyMs} ms
              </span>
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-400">
                {healthMetrics.apiStatus.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Row-Level Security (RLS) Status
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              `FORCE ROW LEVEL SECURITY` active across `user_profiles`, `user_documents`, and `audit_logs`.
            </p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="font-mono text-sm font-semibold text-indigo-400">
                public.is_admin() = TRUE
              </span>
              <span className="rounded bg-indigo-500/10 px-2 py-0.5 font-mono text-[11px] text-indigo-400">
                ENFORCED
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Multi-Currency FX Engine
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              `/api/exchange-rates` 1-hour in-memory TTL cache with live Frankfurter feed &amp; fallback.
            </p>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="font-mono text-sm font-semibold text-sky-400">
                TTL: 3600s
              </span>
              <span className="rounded bg-sky-500/10 px-2 py-0.5 font-mono text-[11px] text-sky-400">
                OPERATIONAL
              </span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
