import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Database,
  Edit3,
  Eye,
  FolderSearch,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react'
import {
  adminDeleteUserProfile,
  adminModerateSubmission,
  adminPurgeContentItem,
  adminUpdateContentItem,
  adminUpdateUserProfile,
  ensureAdminDemoSession,
  fetchAdminGovernanceData,
  useAuthSession,
} from '../lib/supabaseAuth'
import { useCurrency } from '../lib/currency'
import CurrencySwitcher from '../components/CurrencySwitcher'
import {
  adminSyncLiveMarketBenchmarks,
  adminUpdateMineralPrice,
  getStoredMineralPrices,
  subscribeMineralPrices,
} from '../data/mineralPrices'
import type {
  AuditLog,
  ContentStatus,
  MineralPriceRecord,
  UnifiedContentRecord,
  UnifiedContentType,
  UserProfile,
  UserRole,
  UserStatus,
} from '../types/database'

export type MasterAdminSection =
  | 'approvals'
  | 'content'
  | 'users'
  | 'minerals'
  | 'audit'
  | 'health'

export const Route = createFileRoute('/admin')({
  component: () => <MasterAdminDashboard initialSection="approvals" />,
})

const LOGS_PER_PAGE = 8
const CONTENT_PER_PAGE = 8

function getActionBadgeClasses(action: string): string {
  if (
    action.includes('DELETE') ||
    action.includes('PURGE') ||
    action.includes('REJECT') ||
    action.includes('SUSPEND') ||
    action.includes('UNAUTHORIZED') ||
    action.includes('FAILED')
  ) {
    return 'border-danger/40 bg-danger/15 text-danger'
  }
  if (
    action.includes('APPROVE') ||
    action.includes('LOGIN') ||
    action.includes('SIGNUP') ||
    action.includes('ACTIVATE')
  ) {
    return 'border-moss/40 bg-moss-light text-moss'
  }
  return 'border-gold/50 bg-gold/20 text-ochre'
}

function getContentStatusClasses(status: ContentStatus): string {
  switch (status) {
    case 'active':
      return 'border-moss/40 bg-moss-light text-moss'
    case 'pending':
      return 'border-gold/50 bg-gold/20 text-ochre'
    case 'flagged':
    case 'rejected':
      return 'border-danger/40 bg-danger/15 text-danger'
    default:
      return 'border-ink/20 bg-ink/10 text-stone'
  }
}

export function MasterAdminDashboard({
  initialSection = 'approvals',
}: {
  initialSection?: MasterAdminSection
}) {
  const session = useAuthSession()
  const { currency, currencyMeta, rateForSelected, formatExactUsd } = useCurrency()

  const [authorized, setAuthorized] = useState<boolean>(true)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [unifiedContent, setUnifiedContent] = useState<UnifiedContentRecord[]>([])
  const [totalDocuments, setTotalDocuments] = useState(0)
  const [totalProjects, setTotalProjects] = useState(0)
  const [totalQuotes, setTotalQuotes] = useState(0)
  const [dbLatencyMs, setDbLatencyMs] = useState(2)
  const [activeTab, setActiveTab] = useState<MasterAdminSection>(initialSection)

  // Content Explorer Filters & Modals
  const [contentSearch, setContentSearch] = useState('')
  const [contentTypeFilter, setContentTypeFilter] = useState<'ALL' | UnifiedContentType>('ALL')
  const [contentStatusFilter, setContentStatusFilter] = useState<'ALL' | ContentStatus>('ALL')
  const [contentDateFilter, setContentDateFilter] = useState('')
  const [contentPage, setContentPage] = useState(1)
  const [viewingContent, setViewingContent] = useState<UnifiedContentRecord | null>(null)
  const [editingContent, setEditingContent] = useState<UnifiedContentRecord | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDetails, setEditDetails] = useState('')
  const [editStatus, setEditStatus] = useState<ContentStatus>('active')

  // Approvals Queue State
  const [moderationNotes, setModerationNotes] = useState<Record<string, string>>({})

  // User Directory & Activity Inspector State
  const [userSearch, setUserSearch] = useState('')
  const [inspectingUser, setInspectingUser] = useState<UserProfile | null>(null)

  // Mineral Prices (`mineral_prices`) Benchmark State
  const [mineralBenchmarks, setMineralBenchmarks] = useState<MineralPriceRecord[]>(
    () => getStoredMineralPrices()
  )
  const [editingMineral, setEditingMineral] = useState<MineralPriceRecord | null>(null)
  const [editWorldPrice, setEditWorldPrice] = useState('')
  const [editLocalPrice, setEditLocalPrice] = useState('')
  const [editBuyingPrice, setEditBuyingPrice] = useState('')
  const [editTrendPct, setEditTrendPct] = useState('')

  // Audit Log Filters
  const [logSearch, setLogSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    setActiveTab(initialSection)
  }, [initialSection])

  const loadGovernanceTelemetry = useCallback(async () => {
    ensureAdminDemoSession()
    const data = await fetchAdminGovernanceData()
    setAuthorized(data.authorized)
    setUsers(data.users)
    setAuditLogs(data.auditLogs)
    setUnifiedContent(data.unifiedContent)
    setTotalDocuments(data.totalDocuments)
    setTotalProjects(data.totalProjects)
    setTotalQuotes(data.totalQuotes)
    setDbLatencyMs(data.dbLatencyMs)
  }, [])

  useEffect(() => {
    void loadGovernanceTelemetry()
  }, [loadGovernanceTelemetry])

  useEffect(() => {
    setMineralBenchmarks(getStoredMineralPrices())
    return subscribeMineralPrices(() => {
      setMineralBenchmarks(getStoredMineralPrices())
    })
  }, [])

  const userEmailMap = useMemo(() => {
    const map = new Map<string, string>()
    users.forEach((u) => map.set(u.id, u.email))
    return map
  }, [users])

  const pendingApprovals = useMemo(() => {
    return unifiedContent.filter(
      (item) =>
        item.status === 'pending' ||
        item.status === 'flagged' ||
        !item.approved
    )
  }, [unifiedContent])

  const filteredContent = useMemo(() => {
    const q = contentSearch.trim().toLowerCase()
    return unifiedContent.filter((item) => {
      if (contentTypeFilter !== 'ALL' && item.type !== contentTypeFilter) {
        return false
      }
      if (contentStatusFilter !== 'ALL' && item.status !== contentStatusFilter) {
        return false
      }
      if (contentDateFilter && !item.created_at.startsWith(contentDateFilter)) {
        return false
      }
      if (!q) return true
      return (
        item.title.toLowerCase().includes(q) ||
        item.details.toLowerCase().includes(q) ||
        item.owner_email.toLowerCase().includes(q) ||
        item.owner_name.toLowerCase().includes(q) ||
        item.user_id.toLowerCase().includes(q) ||
        item.reference_code.toLowerCase().includes(q) ||
        item.category_badge.toLowerCase().includes(q)
      )
    })
  }, [
    unifiedContent,
    contentSearch,
    contentTypeFilter,
    contentStatusFilter,
    contentDateFilter,
  ])

  const totalContentPages = Math.max(
    1,
    Math.ceil(filteredContent.length / CONTENT_PER_PAGE)
  )
  const paginatedContent = useMemo(() => {
    const start = (contentPage - 1) * CONTENT_PER_PAGE
    return filteredContent.slice(start, start + CONTENT_PER_PAGE)
  }, [filteredContent, contentPage])

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

  const inspectedUserLogs = useMemo(() => {
    if (!inspectingUser) return []
    return auditLogs.filter((l) => l.user_id === inspectingUser.id)
  }, [auditLogs, inspectingUser])

  const inspectedUserContent = useMemo(() => {
    if (!inspectingUser) return []
    return unifiedContent.filter((c) => c.user_id === inspectingUser.id)
  }, [unifiedContent, inspectingUser])

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
  const dayMs = 24 * 60 * 60 * 1000
  const recentLogs24h = auditLogs.filter(
    (l) => now - new Date(l.created_at).getTime() <= dayMs
  )
  const activeActorIds = new Set(recentLogs24h.map((l) => l.user_id).filter(Boolean))
  activeActorIds.add(session.user.id)

  const newSignups7d = users.filter(
    (u) => now - new Date(u.created_at).getTime() <= 7 * dayMs
  ).length
  const newSignups24h = users.filter(
    (u) => now - new Date(u.created_at).getTime() <= dayMs
  ).length

  const activeUsersCount = users.filter((u) => u.status !== 'suspended').length
  const adminUsersCount = users.filter((u) => u.role === 'admin').length

  const handleModerate = async (
    item: UnifiedContentRecord,
    decision: 'APPROVE' | 'REJECT'
  ) => {
    const res = await adminModerateSubmission({
      id: item.id,
      type: item.type,
      decision,
      notes: moderationNotes[item.id],
    })
    if (res.error) {
      setFeedback({ type: 'error', message: res.error })
      return
    }
    setFeedback({
      type: 'success',
      message: `${decision === 'APPROVE' ? 'Approved & Published' : 'Rejected'} ${
        item.type
      } "${item.title}". Immutable audit log recorded.`,
    })
    await loadGovernanceTelemetry()
  }

  const handleSaveContentEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingContent) return
    const res = await adminUpdateContentItem({
      id: editingContent.id,
      type: editingContent.type,
      title: editTitle,
      details: editDetails,
      status: editStatus,
    })
    if (res.error) {
      setFeedback({ type: 'error', message: res.error })
      return
    }
    setFeedback({
      type: 'success',
      message: `Updated ${editingContent.type} "${editTitle}" (status → ${editStatus}). Audit event recorded.`,
    })
    setEditingContent(null)
    await loadGovernanceTelemetry()
  }

  const handlePurgeContent = async (item: UnifiedContentRecord) => {
    if (
      !window.confirm(
        `Permanently purge ${item.type} "${item.title}" from PostgreSQL? This action will be recorded in public.audit_logs.`
      )
    ) {
      return
    }
    const res = await adminPurgeContentItem({
      id: item.id,
      type: item.type,
      title: item.title,
    })
    if (res.error) {
      setFeedback({ type: 'error', message: res.error })
      return
    }
    setFeedback({
      type: 'success',
      message: `Purged ${item.type} "${item.title}". Audit event ADMIN_PURGE_CONTENT recorded.`,
    })
    await loadGovernanceTelemetry()
  }

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

  const handleOpenEditMineral = (mineral: MineralPriceRecord) => {
    setEditingMineral(mineral)
    setEditWorldPrice(String(mineral.world_market_price_usd))
    setEditLocalPrice(String(mineral.local_market_price_usd))
    setEditBuyingPrice(String(mineral.buying_centre_price_usd))
    setEditTrendPct(String(mineral.trend_percentage))
  }

  const handleSaveMineralEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMineral) return
    const worldPrice = Number(editWorldPrice)
    const localPrice = Number(editLocalPrice)
    const buyingPrice = Number(editBuyingPrice)
    const trendPct = Number(editTrendPct)

    if (
      !Number.isFinite(worldPrice) ||
      !Number.isFinite(localPrice) ||
      !Number.isFinite(buyingPrice) ||
      worldPrice <= 0
    ) {
      setFeedback({
        type: 'error',
        message: 'Invalid benchmark numeric values.',
      })
      return
    }

    const res = await adminUpdateMineralPrice({
      id: editingMineral.id,
      world_market_price_usd: worldPrice,
      local_market_price_usd: localPrice,
      buying_centre_price_usd: buyingPrice,
      trend_percentage: Number.isFinite(trendPct) ? trendPct : 0,
    })

    if (res.error || !res.record) {
      setFeedback({
        type: 'error',
        message: res.error || 'Could not locate mineral benchmark row.',
      })
      return
    }

    setMineralBenchmarks(getStoredMineralPrices())
    setEditingMineral(null)
    setFeedback({
      type: 'success',
      message: `Updated ${res.record.mineral_name} (${res.record.symbol}) indicative benchmark rates in public.mineral_prices. Audit event ADMIN_UPDATE_MINERAL_PRICE recorded.`,
    })
    await loadGovernanceTelemetry()
  }

  const handleSyncMineralBenchmarks = async () => {
    const res = await adminSyncLiveMarketBenchmarks()
    if (res.error) {
      setFeedback({ type: 'error', message: res.error })
      return
    }
    setMineralBenchmarks(res.records)
    setFeedback({
      type: 'success',
      message: `Synchronized ${res.records.length} commodities in public.mineral_prices with global LME/LBMA ticks and TMC local market floors.`,
    })
    await loadGovernanceTelemetry()
  }

  return (
    <div className="min-h-screen bg-paper pb-24 pt-28 text-ink">
      <div className="mx-auto max-w-7xl space-y-8 px-5 lg:px-8">
        {/* Top Security & Master Control Banner */}
        <div className="flex flex-col justify-between gap-6 rounded-xl border border-ink/10 bg-ink p-6 text-paper sm:flex-row sm:items-center lg:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-moss/30 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-gold">
                <ShieldCheck size={14} />
                Master Control &amp; Oversight (`public.is_admin() = true`)
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
              Master Control, Content Explorer &amp; Moderation Console
            </h1>
            <p className="mt-1 text-sm text-paper/75">
              Full visibility over all platform content (`/admin/content`), pending moderation queues (`/admin/approvals`), user directory (`/admin/users`), and immutable audit trails.
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
              Refresh DB
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

        {/* Top-Level Master Control Analytics Cards */}
        <section
          aria-label="Master Control Overview Cards"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="rounded-xl border border-ink/10 bg-paper-2/70 p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-stone">
                Pending Approvals Queue
              </span>
              <ClipboardCheck size={16} className="text-ochre" />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">
              {pendingApprovals.length}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ochre">
              Awaiting Compliance Review
            </p>
          </div>

          <div className="rounded-xl border border-ink/10 bg-paper-2/70 p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-stone">
                Total Platform Records
              </span>
              <FolderSearch size={16} className="text-moss" />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">
              {unifiedContent.length}
            </p>
            <p className="mt-1 font-mono text-[11px] text-stone">
              {totalProjects} Projects · {totalDocuments} Docs · {totalQuotes} Quotes
            </p>
          </div>

          <div className="rounded-xl border border-ink/10 bg-paper-2/70 p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-stone">
                Registered Users &amp; Signups
              </span>
              <Users size={16} className="text-ochre" />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">
              {users.length}
            </p>
            <p className="mt-1 font-mono text-[11px] text-moss">
              +{newSignups7d} this week (+{newSignups24h} today)
            </p>
          </div>

          <div className="rounded-xl border border-ink/10 bg-paper-2/70 p-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-stone">
                Active 24h Sessions
              </span>
              <Activity size={16} className="text-moss" />
            </div>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">
              {activeActorIds.size}
            </p>
            <p className="mt-1 font-mono text-[11px] text-stone">
              {adminUsersCount} Admins · {activeUsersCount} Active Profiles
            </p>
          </div>
        </section>

        {/* Master Control Navigation Bar (Supports both SPA tabs & dedicated URL routes) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('approvals')}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                activeTab === 'approvals'
                  ? 'bg-ink text-paper'
                  : 'bg-paper-2 text-ink hover:bg-ink/10'
              }`}
            >
              <ClipboardCheck size={14} />
              Pending Approvals ({pendingApprovals.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('content')}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                activeTab === 'content'
                  ? 'bg-ink text-paper'
                  : 'bg-paper-2 text-ink hover:bg-ink/10'
              }`}
            >
              <FolderSearch size={14} />
              Content Explorer ({unifiedContent.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                activeTab === 'users'
                  ? 'bg-ink text-paper'
                  : 'bg-paper-2 text-ink hover:bg-ink/10'
              }`}
            >
              <Users size={14} />
              User Directory &amp; Analytics ({users.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('minerals')}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                activeTab === 'minerals'
                  ? 'bg-ink text-paper'
                  : 'bg-paper-2 text-ink hover:bg-ink/10'
              }`}
            >
              <Coins size={14} />
              Mineral Prices ({mineralBenchmarks.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                activeTab === 'audit'
                  ? 'bg-ink text-paper'
                  : 'bg-paper-2 text-ink hover:bg-ink/10'
              }`}
            >
              <ShieldCheck size={14} />
              Live Audit Trail ({auditLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('health')}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                activeTab === 'health'
                  ? 'bg-ink text-paper'
                  : 'bg-paper-2 text-ink hover:bg-ink/10'
              }`}
            >
              <Database size={14} />
              System Health
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-stone">
            <span>Direct Routes:</span>
            <Link to="/admin/approvals" className="text-ochre hover:underline">
              /admin/approvals
            </Link>
            <span>·</span>
            <Link to="/admin/content" className="text-ochre hover:underline">
              /admin/content
            </Link>
            <span>·</span>
            <Link to="/admin/users" className="text-ochre hover:underline">
              /admin/users
            </Link>
            <span>·</span>
            <Link to="/markets" className="text-ochre hover:underline">
              /markets
            </Link>
          </div>
        </div>

        {/* ===================================================================
            MODULE 1: MODERATION & PENDING APPROVAL WORKFLOW (/admin/approvals)
           =================================================================== */}
        {activeTab === 'approvals' && (
          <section
            aria-label="Moderation and Pending Approval Queue"
            className="space-y-4 rounded-xl border border-ink/10 bg-paper-2/50 p-6"
          >
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  Moderation &amp; Pending Approval Queue (`/admin/approvals`)
                </h2>
                <p className="text-xs text-stone">
                  Queries all platform submissions where `status = &apos;pending&apos;` / `&apos;flagged&apos;` or `approved = false`. Approving publishes the record and logs `ADMIN_APPROVE_SUBMISSION`.
                </p>
              </div>
              <span className="rounded bg-gold/20 px-3 py-1 font-mono text-xs font-semibold text-ochre">
                {pendingApprovals.length} Item{pendingApprovals.length === 1 ? '' : 's'} Pending Review
              </span>
            </div>

            {pendingApprovals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-ink/15 p-12 text-center text-sm text-stone">
                All pending submissions have been reviewed and cleared!
              </div>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map((item) => (
                  <article
                    key={`${item.type}-${item.id}`}
                    className="rounded-xl border border-ink/10 bg-paper p-5 shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-ink px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-gold">
                          {item.type}
                        </span>
                        <span
                          className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${getContentStatusClasses(
                            item.status
                          )}`}
                        >
                          {item.status} (`approved = false`)
                        </span>
                        <span className="font-mono text-xs text-stone">
                          {item.reference_code}
                        </span>
                      </div>

                      {item.value_usd !== null && (
                        <div className="font-mono text-sm font-semibold text-ochre">
                          Valuation ({currency}): {formatExactUsd(item.value_usd)}
                        </div>
                      )}
                    </div>

                    <h3 className="mt-2 font-display text-xl font-semibold text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 font-mono text-xs text-ochre">
                      {item.category_badge}
                    </p>

                    <p className="mt-3 whitespace-pre-wrap rounded-lg border border-ink/10 bg-paper-2/60 p-4 text-xs leading-relaxed text-ink-3">
                      {item.details}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-stone">
                      <span>
                        Submitted by: <strong className="text-ink">{item.owner_name}</strong> ({item.owner_email})
                      </span>
                      <span>Owner UUID: {item.user_id}</span>
                      <span>Submitted: {new Date(item.created_at).toLocaleString()}</span>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-ink/10 pt-4 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        value={moderationNotes[item.id] ?? ''}
                        onChange={(e) =>
                          setModerationNotes((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        placeholder="Enter compliance verification notes or rejection reason..."
                        className="field flex-1 !py-2 !text-xs"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleModerate(item, 'APPROVE')}
                          className="inline-flex items-center gap-1.5 rounded-md bg-moss px-4 py-2 text-xs font-semibold uppercase tracking-wider text-paper transition hover:opacity-90"
                        >
                          <CheckCircle2 size={14} />
                          Approve &amp; Publish
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleModerate(item, 'REJECT')}
                          className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-danger transition hover:bg-danger/20"
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ===================================================================
            MODULE 2: COMPLETE CONTENT & UPLOADED DETAILS EXPLORER (/admin/content)
           =================================================================== */}
        {activeTab === 'content' && (
          <section
            aria-label="Complete Content and Uploaded Details Explorer"
            className="space-y-5 rounded-xl border border-ink/10 bg-paper-2/50 p-6"
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  Complete Content &amp; Uploaded Details Explorer (`/admin/content`)
                </h2>
                <p className="text-xs text-stone">
                  Aggregates all user-uploaded documents (`user_documents`), listed mineral projects (`user_projects`), and service quote requests (`quote_requests`).
                </p>
              </div>
              <span className="font-mono text-xs text-stone">
                Showing {filteredContent.length} of {unifiedContent.length} total records
              </span>
            </div>

            {/* Real-Time Filtering & Search Controls */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone"
                />
                <input
                  type="search"
                  value={contentSearch}
                  onChange={(e) => {
                    setContentSearch(e.target.value)
                    setContentPage(1)
                  }}
                  placeholder="Search title, owner, UUID, licence..."
                  className="field !py-2 !pl-8 !text-xs"
                />
              </div>

              <select
                value={contentTypeFilter}
                onChange={(e) => {
                  setContentTypeFilter(e.target.value as 'ALL' | UnifiedContentType)
                  setContentPage(1)
                }}
                aria-label="Filter by Content Type"
                className="field !py-2 !text-xs"
              >
                <option value="ALL">All Content Types ({unifiedContent.length})</option>
                <option value="PROJECT">Listed Mining Projects ({totalProjects})</option>
                <option value="OPPORTUNITY">
                  Guided Opportunities ({unifiedContent.filter((c) => c.type === 'OPPORTUNITY').length})
                </option>
                <option value="SERVICE">
                  Technical Services ({unifiedContent.filter((c) => c.type === 'SERVICE').length})
                </option>
                <option value="DOCUMENT">Uploaded Vault Documents ({totalDocuments})</option>
                <option value="QUOTE">Service Quote Requests ({totalQuotes})</option>
              </select>

              <select
                value={contentStatusFilter}
                onChange={(e) => {
                  setContentStatusFilter(e.target.value as 'ALL' | ContentStatus)
                  setContentPage(1)
                }}
                aria-label="Filter by Status"
                className="field !py-2 !text-xs"
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
                value={contentDateFilter}
                onChange={(e) => {
                  setContentDateFilter(e.target.value)
                  setContentPage(1)
                }}
                aria-label="Filter by Creation Date"
                className="field !py-2 !text-xs"
              />
            </div>

            {/* Global Content Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-ink/10 font-mono text-[11px] uppercase text-stone">
                  <tr>
                    <th className="px-3 py-3">Type &amp; Ref</th>
                    <th className="px-3 py-3">Title &amp; Category</th>
                    <th className="px-3 py-3">Owner / User ID</th>
                    <th className="px-3 py-3">Value ({currency})</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Created</th>
                    <th className="px-3 py-3 text-right">Direct Management Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {paginatedContent.map((item) => (
                    <tr key={`${item.type}-${item.id}`} className="hover:bg-paper/60">
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold text-gold">
                          {item.type}
                        </span>
                        <div className="mt-1 font-mono text-[10px] text-stone">
                          {item.reference_code}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-ink">{item.title}</div>
                        <div className="font-mono text-[10px] text-ochre">
                          {item.category_badge}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-ink">{item.owner_email}</div>
                        <div className="font-mono text-[10px] text-stone">
                          {item.user_id}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs font-semibold text-ink">
                        {item.value_usd !== null
                          ? formatExactUsd(item.value_usd)
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${getContentStatusClasses(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-stone">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingContent(item)}
                            className="inline-flex items-center gap-1 rounded border border-ink/20 bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink hover:border-ochre"
                          >
                            <Eye size={12} />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingContent(item)
                              setEditTitle(item.title)
                              setEditDetails(item.details)
                              setEditStatus(item.status)
                            }}
                            className="inline-flex items-center gap-1 rounded border border-gold/50 bg-gold/15 px-2.5 py-1 text-[11px] font-semibold text-ochre hover:bg-gold/25"
                          >
                            <Edit3 size={12} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handlePurgeContent(item)}
                            className="inline-flex items-center gap-1 rounded border border-danger/30 bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger hover:bg-danger/20"
                          >
                            <Trash2 size={12} />
                            Purge
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-ink/10 pt-3 text-xs text-stone">
              <span>
                Page {contentPage} of {totalContentPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={contentPage <= 1}
                  onClick={() => setContentPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-ink/20 px-3 py-1 font-semibold text-ink disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={contentPage >= totalContentPages}
                  onClick={() =>
                    setContentPage((p) => Math.min(totalContentPages, p + 1))
                  }
                  className="rounded border border-ink/20 px-3 py-1 font-semibold text-ink disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ===================================================================
            MODULE 3: COMPREHENSIVE USER DIRECTORY & ANALYTICS (/admin/users)
           =================================================================== */}
        {activeTab === 'users' && (
          <section
            aria-label="Comprehensive User Directory and Database Analytics"
            className="space-y-6 rounded-xl border border-ink/10 bg-paper-2/50 p-6"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  Comprehensive User Directory &amp; Database Analytics (`/admin/users`)
                </h2>
                <p className="text-xs text-stone">
                  Displays sanitized `public.user_profiles` records. Raw password hashes and private auth tokens are strictly excluded by security policy.
                </p>
              </div>

              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by email, name, role, or UUID..."
                className="field !w-72 !py-2 !text-xs"
              />
            </div>

            {/* User Analytics Sub-Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-ink/10 bg-paper p-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone">
                  Total Registered Users
                </span>
                <p className="mt-1 font-display text-2xl font-semibold text-ink">
                  {users.length}
                </p>
                <p className="font-mono text-[11px] text-stone">
                  {adminUsersCount} Admin · {users.length - adminUsersCount} Standard
                </p>
              </div>
              <div className="rounded-lg border border-ink/10 bg-paper p-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone">
                  Active Users (24h Window)
                </span>
                <p className="mt-1 font-display text-2xl font-semibold text-moss">
                  {activeActorIds.size}
                </p>
                <p className="font-mono text-[11px] text-stone">
                  Authenticated JWT Sessions
                </p>
              </div>
              <div className="rounded-lg border border-ink/10 bg-paper p-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone">
                  New User Signups (Daily / Weekly)
                </span>
                <p className="mt-1 font-display text-2xl font-semibold text-ochre">
                  +{newSignups24h} Today / +{newSignups7d} (7d)
                </p>
                <p className="font-mono text-[11px] text-stone">
                  Automated Profile Trigger Active
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-ink/10 font-mono text-[11px] uppercase text-stone">
                  <tr>
                    <th className="px-3 py-3">User Profile &amp; UUID</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Security Metadata Flags</th>
                    <th className="px-3 py-3">Created</th>
                    <th className="px-3 py-3 text-right">Administrative Controls</th>
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
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            <span className="rounded bg-moss-light px-1.5 py-0.5 font-mono text-[10px] text-moss">
                              RLS_SCOPED
                            </span>
                            <span className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[10px] text-stone">
                              HASH_REDACTED
                            </span>
                            <span className="rounded bg-gold/20 px-1.5 py-0.5 font-mono text-[10px] text-ochre">
                              FX:{u.preferred_currency || 'USD'}
                            </span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-stone">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectingUser(u)}
                              className="inline-flex items-center gap-1 rounded border border-ink/25 bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink hover:border-ochre"
                            >
                              <UserCheck size={12} />
                              Inspect Activity
                            </button>
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
                              {u.role === 'admin' ? 'Demote' : 'Promote'}
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

        {/* ===================================================================
            MODULE 4: LIVE AUDIT TRAIL TABLE
           =================================================================== */}
        {activeTab === 'audit' && (
          <section className="rounded-xl border border-ink/10 bg-paper-2/50 p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  Live Security Audit Trail (`public.audit_logs`)
                </h2>
                <p className="text-xs text-stone">
                  Asynchronous activity feed capturing authentication, content moderation, and administrative actions.
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

        {/* ===================================================================
            MODULE 4B: INDICATIVE MINERAL PRICES BENCHMARK CONSOLE (`mineral_prices`)
           =================================================================== */}
        {activeTab === 'minerals' && (
          <section className="rounded-xl border border-ink/10 bg-paper-2/60 p-6">
            <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-5 lg:flex-row lg:items-center">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  Indicative Mineral Prices Benchmark Console (`public.mineral_prices`)
                </h2>
                <p className="text-xs text-stone">
                  Update World Market (`world_market_price_usd`), Local Mineral Market (`local_market_price_usd`), and Buying Centre (`buying_centre_price_usd`) benchmarks. Changes propagate in real time to `/markets` and the Homepage board.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSyncMineralBenchmarks}
                  className="inline-flex items-center gap-1.5 rounded-md border border-ochre/40 bg-ochre/15 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-ochre transition hover:bg-ochre/25"
                >
                  <RefreshCw size={13} />
                  Sync LME / LBMA Tickers
                </button>
                <Link
                  to="/markets"
                  className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-paper transition hover:bg-ink/90"
                >
                  <Eye size={13} />
                  Open Public `/markets` Board
                </Link>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-ink/10 font-mono text-[11px] uppercase tracking-wider text-stone">
                    <th className="px-3 py-3">Commodity &amp; Symbol</th>
                    <th className="px-3 py-3">World Market (USD)</th>
                    <th className="px-3 py-3">Converted ({currency})</th>
                    <th className="px-3 py-3">Mineral Market ({currency})</th>
                    <th className="px-3 py-3">Buying Centre ({currency})</th>
                    <th className="px-3 py-3">24h Trend</th>
                    <th className="px-3 py-3 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/10">
                  {mineralBenchmarks.map((m) => (
                    <tr key={m.id} className="hover:bg-paper/60">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-ink">
                          {m.mineral_name}{' '}
                          <span className="rounded bg-ink px-1.5 py-0.5 font-mono text-[10px] text-gold">
                            {m.symbol}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-stone">
                          {m.category} · {m.unit} · {m.purity_note}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs font-semibold text-ink">
                        ${m.world_market_price_usd.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        <span className="text-[10px] text-stone">
                          {m.unit.replace('USD', '')}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs font-semibold text-ochre">
                        {formatExactUsd(m.world_market_price_usd)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-moss">
                        {formatExactUsd(m.local_market_price_usd)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-ink">
                        {formatExactUsd(m.buying_centre_price_usd)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${
                            m.trend_percentage >= 0
                              ? 'border-moss/40 bg-moss-light text-moss'
                              : 'border-danger/40 bg-danger/15 text-danger'
                          }`}
                        >
                          {m.trend_percentage >= 0 ? '+' : ''}
                          {m.trend_percentage.toFixed(2)}%
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEditMineral(m)}
                          className="inline-flex items-center gap-1 rounded border border-ink/20 bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-ink hover:text-paper"
                        >
                          <Edit3 size={12} />
                          Edit Benchmark
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ===================================================================
            MODULE 5: SYSTEM HEALTH & ACTIVITY MONITOR
           =================================================================== */}
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
                <AlertTriangle size={18} className="text-ochre" />
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

      {/* Modal 1: View Content Details */}
      {viewingContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-xl border border-ink/15 bg-paper p-6 text-ink shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="rounded bg-ink px-2.5 py-0.5 font-mono text-xs text-gold">
                {viewingContent.type} · {viewingContent.reference_code}
              </span>
              <button
                type="button"
                onClick={() => setViewingContent(null)}
                className="text-stone hover:text-ink"
              >
                ✕
              </button>
            </div>
            <h3 className="mt-3 font-display text-2xl font-semibold">
              {viewingContent.title}
            </h3>
            <p className="mt-1 font-mono text-xs text-ochre">
              {viewingContent.category_badge}
            </p>
            <p className="mt-4 whitespace-pre-wrap rounded-lg border border-ink/10 bg-paper-2 p-4 text-xs leading-relaxed">
              {viewingContent.details}
            </p>
            <div className="mt-4 space-y-1 font-mono text-xs text-stone">
              <div>
                Owner: <strong className="text-ink">{viewingContent.owner_name}</strong> ({viewingContent.owner_email})
              </div>
              <div>Owner UUID: {viewingContent.user_id}</div>
              <div>Status: {viewingContent.status.toUpperCase()}</div>
              {viewingContent.moderation_notes && (
                <div>Moderation Notes: {viewingContent.moderation_notes}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Content Metadata */}
      {editingContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/75 p-4 backdrop-blur-xs">
          <form
            onSubmit={(e) => void handleSaveContentEdit(e)}
            className="w-full max-w-xl space-y-4 rounded-xl border border-ink/15 bg-paper p-6 text-ink shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold">
                Edit Metadata — {editingContent.reference_code}
              </h3>
              <button
                type="button"
                onClick={() => setEditingContent(null)}
                className="text-stone hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div>
              <label className="label">Record Title</label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="field"
              />
            </div>
            <div>
              <label className="label">Governance Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as ContentStatus)}
                className="field"
              >
                <option value="active">Active / Verified</option>
                <option value="pending">Pending Review</option>
                <option value="flagged">Flagged</option>
                <option value="archived">Archived</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="label">Content / Summary Payload</label>
              <textarea
                rows={4}
                required
                value={editDetails}
                onChange={(e) => setEditDetails(e.target.value)}
                className="field"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingContent(null)}
                className="btn-ghost !py-2 !px-4 text-xs"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary !py-2 !px-4 text-xs">
                Save Metadata &amp; Log Audit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 3: Inspect User Activity & Uploaded Records */}
      {inspectingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/75 p-4 backdrop-blur-xs">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-ink/15 bg-paper p-6 text-ink shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-[11px] uppercase text-ochre">
                  User Activity &amp; Security Dossier
                </span>
                <h3 className="font-display text-2xl font-semibold">
                  {inspectingUser.full_name || inspectingUser.email}
                </h3>
                <p className="font-mono text-xs text-stone">
                  {inspectingUser.email} · UUID: {inspectingUser.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingUser(null)}
                className="text-stone hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-stone">
                  Uploaded Records &amp; Submissions ({inspectedUserContent.length})
                </h4>
                {inspectedUserContent.length === 0 ? (
                  <p className="mt-2 text-xs text-stone">
                    No uploaded records for this user.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {inspectedUserContent.map((c) => (
                      <div
                        key={`${c.type}-${c.id}`}
                        className="flex items-center justify-between rounded-lg border border-ink/10 bg-paper-2 p-3 text-xs"
                      >
                        <div>
                          <span className="font-mono text-[10px] font-semibold text-ochre">
                            [{c.type}] {c.reference_code}
                          </span>
                          <div className="font-semibold text-ink">{c.title}</div>
                        </div>
                        <span
                          className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${getContentStatusClasses(
                            c.status
                          )}`}
                        >
                          {c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-stone">
                  User Audit Trail Events ({inspectedUserLogs.length})
                </h4>
                {inspectedUserLogs.length === 0 ? (
                  <p className="mt-2 text-xs text-stone">
                    No recorded audit events for this user.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {inspectedUserLogs.map((l) => (
                      <div
                        key={l.id}
                        className="rounded-lg border border-ink/10 bg-paper-2 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="font-semibold text-ochre">
                            {l.action}
                          </span>
                          <span className="text-stone">
                            {new Date(l.created_at).toLocaleString()}
                          </span>
                        </div>
                        <pre className="mt-1 overflow-x-auto text-[10px] text-ink">
                          {JSON.stringify(l.metadata)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Edit Mineral Benchmark Rates (`mineral_prices`) */}
      {editingMineral && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/75 p-4 backdrop-blur-xs">
          <form
            onSubmit={(e) => void handleSaveMineralEdit(e)}
            className="w-full max-w-xl space-y-4 rounded-xl border border-ink/15 bg-paper p-6 text-ink shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] text-gold">
                  {editingMineral.symbol} · {editingMineral.unit}
                </span>
                <h3 className="mt-1 font-display text-xl font-semibold">
                  Update Benchmark — {editingMineral.mineral_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingMineral(null)}
                className="text-stone hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">
                  World Market Price ({editingMineral.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editWorldPrice}
                  onChange={(e) => setEditWorldPrice(e.target.value)}
                  className="field font-mono"
                />
              </div>
              <div>
                <label className="label">
                  Mineral Market Price ({editingMineral.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editLocalPrice}
                  onChange={(e) => setEditLocalPrice(e.target.value)}
                  className="field font-mono"
                />
              </div>
              <div>
                <label className="label">
                  Buying Centre Price ({editingMineral.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editBuyingPrice}
                  onChange={(e) => setEditBuyingPrice(e.target.value)}
                  className="field font-mono"
                />
              </div>
              <div>
                <label className="label">24h Trend Change (%)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editTrendPct}
                  onChange={(e) => setEditTrendPct(e.target.value)}
                  className="field font-mono"
                />
              </div>
            </div>

            <div className="rounded-lg border border-ink/10 bg-paper-2 p-3 font-mono text-[11px] text-stone">
              Preview in active currency ({currency}):{' '}
              <strong className="text-ink">
                {formatExactUsd(Number(editWorldPrice) || 0)}
              </strong>{' '}
              World ·{' '}
              <strong className="text-moss">
                {formatExactUsd(Number(editLocalPrice) || 0)}
              </strong>{' '}
              Mineral Market
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingMineral(null)}
                className="btn-ghost !py-2 !px-4 text-xs"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary !py-2 !px-4 text-xs">
                Save Benchmark &amp; Log Audit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
