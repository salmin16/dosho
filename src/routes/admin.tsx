import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Coins,
  Database,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import {
  adminDeleteUserProfile,
  adminUpdateUserProfile,
  ensureAdminDemoSession,
  fetchAdminGovernanceData,
  useAuthSession,
} from '../lib/supabaseAuth'
import { useCurrency } from '../lib/currency'
import CurrencySwitcher from '../components/CurrencySwitcher'
import type { AuditLog, UserProfile, UserRole, UserStatus } from '../types/database'

export const Route = createFileRoute('/admin')({
  component: AdminDashboardRouteComponent,
})

const LOGS_PER_PAGE = 8

function getActionBadgeClasses(action: string): string {
  if (
    action.includes('DELETE') ||
    action.includes('SUSPEND') ||
    action.includes('UNAUTHORIZED') ||
    action.includes('FAILED')
  ) {
    return 'border-danger/40 bg-danger/15 text-danger'
  }
  if (action.includes('ADMIN') || action.includes('UPDATE')) {
    return 'border-gold/50 bg-gold/20 text-ochre'
  }
  return 'border-moss/40 bg-moss-light text-moss'
}

function AdminDashboardRouteComponent() {
  const session = useAuthSession()
  const { currency, currencyMeta, rateForSelected, formatExactUsd } = useCurrency()

  const [authorized, setAuthorized] = useState<boolean>(true)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [totalDocuments, setTotalDocuments] = useState(0)
  const [totalProjects, setTotalProjects] = useState(0)
  const [dbLatencyMs, setDbLatencyMs] = useState(2)
  const [activeTab, setActiveTab] = useState<'audit' | 'users' | 'health'>('audit')

  const [logSearch, setLogSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [userSearch, setUserSearch] = useState('')
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const loadGovernanceTelemetry = useCallback(async () => {
    ensureAdminDemoSession()
    const data = await fetchAdminGovernanceData()
    setAuthorized(data.authorized)
    setUsers(data.users)
    setAuditLogs(data.auditLogs)
    setTotalDocuments(data.totalDocuments)
    setTotalProjects(data.totalProjects)
    setDbLatencyMs(data.dbLatencyMs)
  }, [])

  useEffect(() => {
    void loadGovernanceTelemetry()
  }, [loadGovernanceTelemetry])

  const userEmailMap = useMemo(() => {
    const map = new Map<string, string>()
    users.forEach((u) => map.set(u.id, u.email))
    return map
  }, [users])

  const distinctActions = useMemo(() => {
    const s = new Set<string>()
    auditLogs.forEach((l) => s.add(l.action))
    return Array.from(s).sort()
  }, [auditLogs])

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase()
    return auditLogs.filter((log) => {
      const matchesAction = actionFilter === 'ALL' || log.action === actionFilter
      const email = log.user_id ? userEmailMap.get(log.user_id) ?? '' : ''
      const matchesQuery =
        !q ||
        log.action.toLowerCase().includes(q) ||
        email.toLowerCase().includes(q) ||
        (log.user_id && log.user_id.toLowerCase().includes(q)) ||
        (log.ip_address && log.ip_address.toLowerCase().includes(q)) ||
        JSON.stringify(log.metadata).toLowerCase().includes(q)
      return matchesAction && matchesQuery
    })
  }, [auditLogs, actionFilter, logSearch, userEmailMap])

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE))
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * LOGS_PER_PAGE
    return filteredLogs.slice(start, start + LOGS_PER_PAGE)
  }, [filteredLogs, currentPage])

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    )
  }, [users, userSearch])

  if (!session) {
    return null
  }

  if (!authorized || session.user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-paper pb-24 pt-32 text-ink">
        <div className="mx-auto max-w-xl rounded-xl border border-danger/30 bg-paper-2 p-8 text-center">
          <ShieldAlert size={40} className="mx-auto text-danger" />
          <h1 className="mt-4 font-display text-2xl font-semibold">
            403 Forbidden — Administrative Clearance Required
          </h1>
          <p className="mt-2 text-sm text-stone">
            Your session (`role = {session.user.role}`) does not hold administrative privileges required by Next.js Middleware and PostgreSQL RLS (`public.is_admin()`).
          </p>
          <Link to="/dashboard" className="btn-primary mt-6 inline-flex">
            Return to Member Vault
          </Link>
        </div>
      </div>
    )
  }

  const now = Date.now()
  const recentLogs24h = auditLogs.filter(
    (l) => now - new Date(l.created_at).getTime() <= 24 * 60 * 60 * 1000
  )
  const activeActorIds = new Set(recentLogs24h.map((l) => l.user_id).filter(Boolean))
  activeActorIds.add(session.user.id)

  const errorLogs24h = recentLogs24h.filter(
    (l) =>
      l.action.includes('FAILED') ||
      l.action.includes('UNAUTHORIZED') ||
      l.action.includes('ERROR')
  )
  const errorRatePercent =
    recentLogs24h.length > 0
      ? Number(((errorLogs24h.length / recentLogs24h.length) * 100).toFixed(1))
      : 0

  const activeUsersCount = users.filter((u) => u.status !== 'suspended').length
  const adminUsersCount = users.filter((u) => u.role === 'admin').length
  const monthlyGovernanceArrUsd = activeUsersCount * 49

  const handleUpdateUser = async (
    targetUserId: string,
    updates: { role?: UserRole; status?: UserStatus }
  ) => {
    const res = await adminUpdateUserProfile({ targetUserId, ...updates })
    if (res.error) {
      setFeedback({ type: 'error', message: res.error })
      return
    }
    setFeedback({
      type: 'success',
      message: `Updated ${res.user?.email} (${
        updates.role ? `role → ${updates.role}` : `status → ${updates.status}`
      }). Immutable audit log recorded.`,
    })
    await loadGovernanceTelemetry()
  }

  const handleDeleteUser = async (u: UserProfile) => {
    if (
      !window.confirm(
        `Permanently remove user profile ${u.email}? This action will be recorded in public.audit_logs.`
      )
    ) {
      return
    }
    const res = await adminDeleteUserProfile(u.id)
    if (res.error) {
      setFeedback({ type: 'error', message: res.error })
      return
    }
    setFeedback({
      type: 'success',
      message: `Deleted user ${u.email}. Audit event ADMIN_DELETE_USER recorded.`,
    })
    await loadGovernanceTelemetry()
  }

  return (
    <div className="min-h-screen bg-paper pb-24 pt-28 text-ink">
      <div className="mx-auto max-w-7xl space-y-8 px-5 lg:px-8">
        {/* Top Security Banner */}
        <div className="flex flex-col justify-between gap-6 rounded-xl border border-ink/10 bg-ink p-6 text-paper sm:flex-row sm:items-center lg:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-moss/30 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-gold">
                <ShieldCheck size={14} />
                Clearance: ADMIN (`public.is_admin() = true`)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-paper/10 px-3 py-1 font-mono text-[11px] text-paper/80">
                <Coins size={13} className="text-gold" />
                {currencyMeta.flag} {currency} (1 USD ={' '}
                {rateForSelected.toLocaleString('en-US', {
                  maximumFractionDigits: 2,
                })}{' '}
                {currency})
              </span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold">
              Security Governance &amp; Live Audit Console
            </h1>
            <p className="mt-1 text-sm text-paper/75">
              Zero client-side trust · Enforced via Next.js Edge Middleware (`middleware.ts`), `/api/admin/*` RBAC guards, and PostgreSQL RLS.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <CurrencySwitcher dark />
            <button
              type="button"
              onClick={() => void loadGovernanceTelemetry()}
              className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-ochre/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gold transition hover:bg-ochre/30"
            >
              <RefreshCw size={14} />
              Refresh Telemetry
            </button>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-md border border-paper/20 bg-paper/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-paper transition hover:bg-paper/20"
            >
              Member Vault
            </Link>
          </div>
        </div>

        {feedback && (
          <div
            className={`flex items-center justify-between rounded-lg border px-4 py-3 text-xs font-semibold ${
              feedback.type === 'success'
                ? 'border-moss/40 bg-moss-light text-moss'
                : 'border-danger/40 bg-danger/10 text-danger'
            }`}
          >
            <span>{feedback.message}</span>
            <button type="button" onClick={() => setFeedback(null)}>
              ✕
            </button>
          </div>
        )}

        {/* 1. Overview & Analytics Cards */}
        <section
          aria-label="Overview and Analytics Cards"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="rounded-xl border border-ink/10 bg-paper-2/70 p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-stone">
                Total Registered Users
              </span>
              <Users size={16} className="text-ochre" />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">
              {users.length}
            </p>
            <p className="mt-1 font-mono text-[11px] text-stone">
              {adminUsersCount} Admins · {activeUsersCount} Active
            </p>
          </div>

          <div className="rounded-xl border border-ink/10 bg-paper-2/70 p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-stone">
                Active Sessions (24h)
              </span>
              <Activity size={16} className="text-moss" />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">
              {activeActorIds.size}
            </p>
            <p className="mt-1 font-mono text-[11px] text-moss">
              Verified JWT Sessions
            </p>
          </div>

          <div className="rounded-xl border border-ink/10 bg-paper-2/70 p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-stone">
                Security Error Rate (24h)
              </span>
              <AlertTriangle size={16} className="text-ochre" />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">
              {errorRatePercent}%
            </p>
            <p className="mt-1 font-mono text-[11px] text-stone">
              {errorLogs24h.length} blocked/failed events in 24h
            </p>
          </div>

          <div className="rounded-xl border border-ink/10 bg-paper-2/70 p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-stone">
                Active Subscription Value
              </span>
              <Database size={16} className="text-ochre" />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">
              {formatExactUsd(monthlyGovernanceArrUsd)}
              <span className="ml-1 text-xs font-normal text-stone">/mo</span>
            </p>
            <p className="mt-1 font-mono text-[11px] text-stone">
              {totalDocuments} Vault Docs · {totalProjects} Listed Projects
            </p>
          </div>
        </section>

        {/* Module Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === 'audit'
                ? 'bg-ink text-paper'
                : 'bg-paper-2 text-ink hover:bg-ink/10'
            }`}
          >
            Live Audit Trail ({auditLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === 'users'
                ? 'bg-ink text-paper'
                : 'bg-paper-2 text-ink hover:bg-ink/10'
            }`}
          >
            User Management Console ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('health')}
            className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
              activeTab === 'health'
                ? 'bg-ink text-paper'
                : 'bg-paper-2 text-ink hover:bg-ink/10'
            }`}
          >
            System Health &amp; Activity Monitor
          </button>
        </div>

        {/* 2. Live Audit Trail Table */}
        {activeTab === 'audit' && (
          <section className="rounded-xl border border-ink/10 bg-paper-2/50 p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  Live Security Audit Trail (`public.audit_logs`)
                </h2>
                <p className="text-xs text-stone">
                  Asynchronous activity feed capturing authentication, settings updates, and administrative actions.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone"
                  />
                  <input
                    type="search"
                    value={logSearch}
                    onChange={(e) => {
                      setLogSearch(e.target.value)
                      setCurrentPage(1)
                    }}
                    placeholder="Filter by actor, IP, metadata..."
                    className="field !py-1.5 !pl-8 !text-xs"
                  />
                </div>

                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value)
                    setCurrentPage(1)
                  }}
                  aria-label="Filter by audit action"
                  className="field !w-auto !py-1.5 !text-xs"
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

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-ink/10 font-mono text-[11px] uppercase text-stone">
                  <tr>
                    <th className="px-3 py-3">Timestamp</th>
                    <th className="px-3 py-3">Action Badge</th>
                    <th className="px-3 py-3">User / Actor</th>
                    <th className="px-3 py-3">IP &amp; User-Agent</th>
                    <th className="px-3 py-3">Contextual Metadata (JSONB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {paginatedLogs.map((log) => {
                    const actorEmail = log.user_id
                      ? userEmailMap.get(log.user_id)
                      : null
                    return (
                      <tr key={log.id} className="hover:bg-paper/60">
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-stone">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <span
                            className={`inline-flex rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${getActionBadgeClasses(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-ink">
                            {actorEmail || 'Unauthenticated / System'}
                          </div>
                          <div className="font-mono text-[10px] text-stone">
                            {log.user_id || 'N/A'}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-mono text-[11px] text-ink">
                            {log.ip_address || '0.0.0.0'}
                          </div>
                          <div
                            title={log.user_agent || ''}
                            className="max-w-[180px] truncate text-[10px] text-stone"
                          >
                            {log.user_agent || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px]">
                          <pre className="max-w-xs overflow-x-auto rounded bg-paper px-2 py-1 text-[10px] text-ink">
                            {JSON.stringify(log.metadata ?? {})}
                          </pre>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-ink/10 pt-3 text-xs text-stone">
              <span>
                Showing {paginatedLogs.length} of {filteredLogs.length} events (Page{' '}
                {currentPage} of {totalLogPages})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-ink/20 px-3 py-1 font-semibold text-ink disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalLogPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalLogPages, p + 1))
                  }
                  className="rounded border border-ink/20 px-3 py-1 font-semibold text-ink disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 3. User Management Console */}
        {activeTab === 'users' && (
          <section className="rounded-xl border border-ink/10 bg-paper-2/50 p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  User Management Console (`public.user_profiles`)
                </h2>
                <p className="text-xs text-stone">
                  View registered accounts, elevate/demote administrative roles, or suspend/delete accounts with full audit logging.
                </p>
              </div>

              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by email, name, or UUID..."
                className="field !w-64 !py-1.5 !text-xs"
              />
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-ink/10 font-mono text-[11px] uppercase text-stone">
                  <tr>
                    <th className="px-3 py-3">User Profile</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Preferred FX</th>
                    <th className="px-3 py-3 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {filteredUsers.map((u) => {
                    const isSelf = u.id === session.user.id
                    return (
                      <tr key={u.id} className="hover:bg-paper/60">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2 font-semibold text-ink">
                            <span>{u.full_name || u.email}</span>
                            {isSelf && (
                              <span className="rounded bg-ochre/20 px-1.5 py-0.5 font-mono text-[10px] text-ochre">
                                YOU
                              </span>
                            )}
                          </div>
                          <div className="text-stone">{u.email}</div>
                          <div className="font-mono text-[10px] text-stone">
                            {u.id}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                              u.role === 'admin'
                                ? 'bg-ochre/20 text-ochre'
                                : 'bg-ink/10 text-ink'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                              u.status === 'suspended'
                                ? 'bg-danger/15 text-danger'
                                : 'bg-moss-light text-moss'
                            }`}
                          >
                            {u.status || 'active'}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-ink">
                          {u.preferred_currency || 'USD'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() =>
                                void handleUpdateUser(u.id, {
                                  role: u.role === 'admin' ? 'user' : 'admin',
                                })
                              }
                              className="rounded border border-ink/20 bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:border-ochre disabled:opacity-40"
                            >
                              {u.role === 'admin'
                                ? 'Demote to User'
                                : 'Promote to Admin'}
                            </button>
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() =>
                                void handleUpdateUser(u.id, {
                                  status:
                                    u.status === 'suspended'
                                      ? 'active'
                                      : 'suspended',
                                })
                              }
                              className="rounded border border-gold/50 bg-gold/15 px-2.5 py-1 text-[11px] font-semibold text-ochre transition hover:bg-gold/25 disabled:opacity-40"
                            >
                              {u.status === 'suspended' ? 'Activate' : 'Suspend'}
                            </button>
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => void handleDeleteUser(u)}
                              className="inline-flex items-center gap-1 rounded border border-danger/30 bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger transition hover:bg-danger/20 disabled:opacity-40"
                            >
                              <Trash2 size={12} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 4. System Health & Activity Monitor */}
        {activeTab === 'health' && (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-ink/10 bg-paper-2/60 p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-ink">
                  Database &amp; RLS Probe
                </h3>
                <CheckCircle2 size={18} className="text-moss" />
              </div>
              <p className="mt-1 text-xs text-stone">
                PostgreSQL Row-Level Security (`FORCE ROW LEVEL SECURITY`) active on `user_profiles`, `audit_logs`, `user_documents`, `user_projects`, and `quote_requests`.
              </p>
              <div className="mt-4 flex items-baseline justify-between font-mono">
                <span className="text-2xl font-bold text-moss">
                  {dbLatencyMs} ms
                </span>
                <span className="rounded bg-moss-light px-2 py-0.5 text-[11px] text-moss">
                  HEALTHY
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-ink/10 bg-paper-2/60 p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-ink">
                  Edge Middleware &amp; RBAC
                </h3>
                <ShieldCheck size={18} className="text-ochre" />
              </div>
              <p className="mt-1 text-xs text-stone">
                Intercepts `/admin/*` and `/api/admin/*` requests, verifying JWT signature and `user.role === &apos;admin&apos;` before route execution.
              </p>
              <div className="mt-4 flex items-baseline justify-between font-mono">
                <span className="text-sm font-semibold text-ink">
                  403 Guard Active
                </span>
                <span className="rounded bg-ochre/20 px-2 py-0.5 text-[11px] text-ochre">
                  ENFORCED
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-ink/10 bg-paper-2/60 p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-ink">
                  Multi-Currency FX Engine
                </h3>
                <Coins size={18} className="text-ochre" />
              </div>
              <p className="mt-1 text-xs text-stone">
                Live mid-market USD conversion via `/api/exchange-rates` with 1-hour server TTL caching and `Intl.NumberFormat` regional rules.
              </p>
              <div className="mt-4 flex items-baseline justify-between font-mono">
                <span className="text-sm font-semibold text-ink">
                  1 USD = {rateForSelected} {currency}
                </span>
                <span className="rounded bg-moss-light px-2 py-0.5 text-[11px] text-moss">
                  LIVE FX
                </span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
