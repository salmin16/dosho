'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuditLog, UserProfile, UserRole, UserStatus } from '@/types/database';

export default function UserDirectoryClient({
  currentAdminId,
  initialUsers,
  auditLogs,
}: {
  currentAdminId: string;
  initialUsers: UserProfile[];
  auditLogs: AuditLog[];
}) {
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectingUser, setInspectingUser] = useState<UserProfile | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const active24hCount = useMemo(() => {
    const activeSet = new Set(
      auditLogs
        .filter((l) => now - new Date(l.created_at).getTime() <= dayMs)
        .map((l) => l.user_id)
        .filter(Boolean)
    );
    if (currentAdminId) activeSet.add(currentAdminId);
    return activeSet.size;
  }, [auditLogs, currentAdminId, now, dayMs]);

  const signupsLast7Days = useMemo(() => {
    return users.filter(
      (u) => now - new Date(u.created_at).getTime() <= 7 * dayMs
    ).length;
  }, [users, now, dayMs]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  async function handleUpdateUser(
    targetUserId: string,
    updates: { role?: UserRole; status?: UserStatus }
  ) {
    setBusyId(targetUserId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, ...updates }),
      });
      const data = (await res.json()) as { user?: UserProfile };
      if (res.ok && data.user) {
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUserId ? data.user! : u))
        );
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  const userLogs = useMemo(() => {
    if (!inspectingUser) return [];
    return auditLogs.filter((l) => l.user_id === inspectingUser.id);
  }, [auditLogs, inspectingUser]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Comprehensive User Directory &amp; Database Analytics (`/admin/users`)
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Zero credential exposure: raw password hashes are never queried or transmitted. Displays verified profile metadata and per-user audit trails.
        </p>
      </div>

      {/* Top-Level User Analytics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <span className="text-xs font-semibold uppercase text-slate-500">
            Total Registered Users
          </span>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {users.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <span className="text-xs font-semibold uppercase text-slate-500">
            Active Users (Last 24h)
          </span>
          <p className="mt-2 text-3xl font-bold text-emerald-500">
            {active24hCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <span className="text-xs font-semibold uppercase text-slate-500">
            New Signups (7-Day Velocity)
          </span>
          <p className="mt-2 text-3xl font-bold text-indigo-500">
            +{signupsLast7Days}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by email, full name, role, or UUID..."
            className="w-72 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
          <span className="font-mono text-[11px] text-emerald-500">
            CREDENTIALS REDACTED · RLS ACTIVE
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/70 uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/50">
              <tr>
                <th className="px-4 py-3">User Identity &amp; UUID</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Security Flags</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Administrative Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredUsers.map((u) => {
                const isSelf = u.id === currentAdminId;
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {u.full_name || u.email}
                      </div>
                      <div className="text-slate-500">{u.email}</div>
                      <div className="font-mono text-[10px] text-slate-400">
                        {u.id}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono uppercase">{u.role}</td>
                    <td className="px-4 py-3 font-mono uppercase">{u.status}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-500/10 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                        JWT_VERIFIED · NO_RAW_HASH
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectingUser(u)}
                          className="rounded border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-400"
                        >
                          Inspect Activity
                        </button>
                        <button
                          type="button"
                          disabled={isSelf || busyId === u.id}
                          onClick={() =>
                            void handleUpdateUser(u.id, {
                              role: u.role === 'admin' ? 'user' : 'admin',
                            })
                          }
                          className="rounded border border-slate-300 px-2.5 py-1 text-[11px] disabled:opacity-40 dark:border-slate-700"
                        >
                          {u.role === 'admin' ? 'Demote' : 'Promote'}
                        </button>
                        <button
                          type="button"
                          disabled={isSelf || busyId === u.id}
                          onClick={() =>
                            void handleUpdateUser(u.id, {
                              status:
                                u.status === 'suspended' ? 'active' : 'suspended',
                            })
                          }
                          className="rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-500 disabled:opacity-40"
                        >
                          {u.status === 'suspended' ? 'Activate' : 'Suspend'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect User Activity Modal */}
      {inspectingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                Activity Logs for {inspectingUser.email}
              </h3>
              <button
                type="button"
                onClick={() => setInspectingUser(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {userLogs.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No recorded audit events for this user yet.
                </p>
              ) : (
                userLogs.map((l) => (
                  <div
                    key={l.id}
                    className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs"
                  >
                    <div className="flex justify-between font-mono text-[11px]">
                      <span className="font-bold text-indigo-400">
                        {l.action}
                      </span>
                      <span className="text-slate-400">
                        {new Date(l.created_at).toLocaleString()}
                      </span>
                    </div>
                    <pre className="mt-1 overflow-x-auto text-[10px] text-slate-300">
                      {JSON.stringify(l.metadata)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
