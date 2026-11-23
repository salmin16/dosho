import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  Clock,
  Coins,
  Compass,
  EyeOff,
  FileText,
  LayoutDashboard,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Star,
  Trash2,
  UserCheck,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react'
import {
  adminDeleteUserProfile,
  adminModerateEntity,
  adminPurgeContentItem,
  adminUpdateUserProfile,
  adminVerifyUserProfile,
  fetchAdminGovernanceData,
  useAuthState,
} from '../lib/supabaseAuth'
import { useLocalization } from '../context/LocalizationContext'
import CurrencySwitcher from '../components/CurrencySwitcher'
import LanguageSwitcher from '../components/LanguageSwitcher'
import PriceDisplay from '../components/PriceDisplay'
import {
  adminSyncLiveMarketBenchmarks,
  adminUpdateMineralPrice,
  getStoredMineralPrices,
  subscribeMineralPrices,
} from '../data/mineralPrices'
import type {
  AdminAuditLogRecord,
  MineralPriceRecord,
  QuoteRequestRecord,
  UserListedProject,
  UserOpportunityRecord,
  UserProfile,
  UserRole,
  UserServiceRecord,
  UserStatus,
} from '../types/database'

export type MasterAdminSection =
  | 'overview'
  | 'approvals'
  | 'content'
  | 'users'
  | 'services'
  | 'opportunities'
  | 'quotes_audit'
  | 'minerals'

export const Route = createFileRoute('/admin')({
  component: () => <MasterAdminDashboard initialSection="overview" />,
})

function mapInitialTab(
  section: MasterAdminSection
): 'overview' | 'users' | 'services' | 'opportunities' | 'quotes_audit' | 'minerals' {
  if (section === 'approvals') return 'opportunities'
  if (section === 'content') return 'services'
  if (
    section === 'overview' ||
    section === 'users' ||
    section === 'services' ||
    section === 'opportunities' ||
    section === 'quotes_audit' ||
    section === 'minerals'
  ) {
    return section
  }
  return 'overview'
}

function normalizeDisplayStatus(status: string, approved?: boolean): 'pending' | 'approved' | 'rejected' | 'hidden' {
  const s = String(status || '').toLowerCase()
  if (s === 'rejected') return 'rejected'
  if (s === 'hidden' || s === 'archived' || s === 'closed') return 'hidden'
  if (s === 'approved' || s === 'active' || s === 'verified' || s === 'quoted' || approved) {
    return 'approved'
  }
  return 'pending'
}

function statusPillClasses(state: 'pending' | 'approved' | 'rejected' | 'hidden'): string {
  switch (state) {
    case 'approved':
      return 'border-moss/40 bg-moss-light text-moss'
    case 'pending':
      return 'border-gold/50 bg-gold/20 text-ochre'
    case 'rejected':
      return 'border-danger/40 bg-danger/15 text-danger'
    case 'hidden':
      return 'border-ink/20 bg-ink/10 text-stone'
  }
}

function verificationBadgeClasses(status?: string): string {
  switch (status) {
    case 'verified':
      return 'border-moss/40 bg-moss-light text-moss'
    case 'pending':
      return 'border-gold/50 bg-gold/20 text-ochre'
    case 'rejected':
      return 'border-danger/40 bg-danger/15 text-danger'
    default:
      return 'border-ink/15 bg-paper text-stone'
  }
}

function auditBadgeClasses(action: string): string {
  if (
    action.includes('DELETE') ||
    action.includes('PURGE') ||
    action.includes('REJECT') ||
    action.includes('SUSPEND') ||
    action.includes('REVOKE') ||
    action.includes('UNAUTHORIZED')
  ) {
    return 'border-danger/40 bg-danger/15 text-danger'
  }
  if (
    action.includes('APPROVE') ||
    action.includes('VERIFY') ||
    action.includes('SIGNUP') ||
    action.includes('FEATURE')
  ) {
    return 'border-moss/40 bg-moss-light text-moss'
  }
  return 'border-gold/50 bg-gold/20 text-ochre'
}

export function MasterAdminDashboard({
  initialSection = 'overview',
}: {
  initialSection?: MasterAdminSection
}) {
  const navigate = useNavigate()
  const {
    session,
    isAdmin,
    loading: authLoading,
    profileLoading,
    profileError,
  } = useAuthState()
  const { currency, language, currencyMeta, rateForSelected, ui } = useLocalization()

  const [authorized, setAuthorized] = useState(false)
  const [loadingGovernance, setLoadingGovernance] = useState(true)
  const [activeTab, setActiveTab] = useState<
    'overview' | 'users' | 'services' | 'opportunities' | 'quotes_audit' | 'minerals'
  >(() => mapInitialTab(initialSection))

  const [users, setUsers] = useState<UserProfile[]>([])
  const [services, setServices] = useState<UserServiceRecord[]>([])
  const [opportunities, setOpportunities] = useState<UserOpportunityRecord[]>([])
  const [projects, setProjects] = useState<UserListedProject[]>([])
  const [quotes, setQuotes] = useState<QuoteRequestRecord[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRecord[]>([])
  const [dbLatencyMs, setDbLatencyMs] = useState(0)

  // Filters & inline action inputs
  const [userSearch, setUserSearch] = useState('')
  const [userVerifFilter, setUserVerifFilter] = useState<'ALL' | 'pending' | 'verified' | 'unverified' | 'rejected' | 'suspended'>('ALL')
  const [verifNotesMap, setVerifNotesMap] = useState<Record<string, string>>({})

  const [serviceSearch, setServiceSearch] = useState('')
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'ALL' | 'pending' | 'approved' | 'rejected' | 'hidden'>('ALL')

  const [oppSearch, setOppSearch] = useState('')
  const [oppKindFilter, setOppKindFilter] = useState<'ALL' | 'OPPORTUNITY' | 'PROJECT'>('ALL')
  const [oppStatusFilter, setOppStatusFilter] = useState<'ALL' | 'pending' | 'approved' | 'rejected' | 'hidden'>('ALL')

  const [quoteStatusFilter, setQuoteStatusFilter] = useState<'ALL' | 'pending' | 'approved' | 'rejected' | 'hidden'>('ALL')
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({})

  const [auditSearch, setAuditSearch] = useState('')
  const [auditActionFilter, setAuditActionFilter] = useState('ALL')

  // Mineral benchmarks panel state
  const [mineralBenchmarks, setMineralBenchmarks] = useState<MineralPriceRecord[]>(
    () => getStoredMineralPrices()
  )
  const [editingMineral, setEditingMineral] = useState<MineralPriceRecord | null>(null)
  const [editWorldPrice, setEditWorldPrice] = useState('')
  const [editLocalPrice, setEditLocalPrice] = useState('')
  const [editBuyingPrice, setEditBuyingPrice] = useState('')
  const [editTrendPct, setEditTrendPct] = useState('')

  const [busyId, setBusyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    setActiveTab(mapInitialTab(initialSection))
  }, [initialSection])

  const loadGovernanceTelemetry = useCallback(async () => {
    setLoadingGovernance(true)
    try {
      const data = await fetchAdminGovernanceData()
      setAuthorized(data.authorized)
      setUsers(data.users)
      setServices(data.servicesList)
      setOpportunities(data.opportunitiesList)
      setProjects(data.projectsList)
      setQuotes(data.quotesList)
      setAuditLogs(data.adminAuditLogs)
      setDbLatencyMs(data.dbLatencyMs)
      if (data.dbError) {
        setFeedback({
          type: 'error',
          message: `Supabase query warning: ${data.dbError}`,
        })
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? `Failed to load Supabase governance data: ${err.message}`
            : 'Failed to load Supabase governance data.',
      })
    } finally {
      setLoadingGovernance(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || profileLoading) return
    if (!session) {
      setAuthorized(false)
      setLoadingGovernance(false)
      return
    }
    if (!isAdmin) {
      setAuthorized(false)
      setLoadingGovernance(false)
      navigate({ to: '/dashboard' })
      return
    }
    void loadGovernanceTelemetry()
  }, [authLoading, profileLoading, session, isAdmin, navigate, loadGovernanceTelemetry])

  useEffect(() => {
    setMineralBenchmarks(getStoredMineralPrices())
    return subscribeMineralPrices(() => {
      setMineralBenchmarks(getStoredMineralPrices())
    })
  }, [])

  const profileMap = useMemo(() => {
    const map = new Map<string, UserProfile>()
    users.forEach((u) => map.set(u.id, u))
    return map
  }, [users])

  // KPI metrics
  const kpis = useMemo(() => {
    const verifiedUsers = users.filter((u) => u.verification_status === 'verified').length
    const pendingVerifications = users.filter((u) => u.verification_status === 'pending').length
    const pendingServices = services.filter((s) => normalizeDisplayStatus(s.status, s.approved) === 'pending').length
    const pendingOpportunities = opportunities.filter((o) => normalizeDisplayStatus(o.status, o.approved) === 'pending').length
    const pendingProjects = projects.filter((p) => normalizeDisplayStatus(p.status, p.approved) === 'pending').length
    const pendingQuotes = quotes.filter((q) => normalizeDisplayStatus(q.status, q.approved) === 'pending').length
    return {
      totalUsers: users.length,
      verifiedUsers,
      pendingVerifications,
      pendingServices,
      pendingOpportunities,
      pendingProjects,
      pendingQuotes,
    }
  }, [users, services, opportunities, projects, quotes])

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    return users.filter((u) => {
      if (userVerifFilter === 'suspended' && u.status !== 'suspended') return false
      if (
        userVerifFilter !== 'ALL' &&
        userVerifFilter !== 'suspended' &&
        (u.verification_status || 'unverified') !== userVerifFilter
      ) {
        return false
      }
      if (!q) return true
      return (
        u.email.toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.company_name || '').toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      )
    })
  }, [users, userSearch, userVerifFilter])

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase()
    return services.filter((s) => {
      const norm = normalizeDisplayStatus(s.status, s.approved)
      if (serviceStatusFilter !== 'ALL' && norm !== serviceStatusFilter) return false
      if (!q) return true
      const owner = profileMap.get(s.user_id)
      return (
        s.service_name.toLowerCase().includes(q) ||
        s.provider_organization.toLowerCase().includes(q) ||
        s.expertise_area.toLowerCase().includes(q) ||
        (owner?.email || '').toLowerCase().includes(q)
      )
    })
  }, [services, serviceSearch, serviceStatusFilter, profileMap])

  const combinedOppAndProjects = useMemo(() => {
    const q = oppSearch.trim().toLowerCase()
    const rows = [
      ...opportunities.map((o) => ({
        kind: 'OPPORTUNITY' as const,
        id: o.id,
        user_id: o.user_id,
        title: o.title,
        subtitle: `${o.organization} · ${o.category} · ${o.location}`,
        description: o.description,
        valueUsd: o.compensation_usd,
        status: normalizeDisplayStatus(o.status, o.approved),
        approved: Boolean(o.approved),
        isFeatured: Boolean(o.is_featured),
        rejectionReason: o.rejection_reason || o.moderation_notes || null,
        referenceCode: o.reference_code,
        createdAt: o.created_at,
      })),
      ...projects.map((p) => ({
        kind: 'PROJECT' as const,
        id: p.id,
        user_id: p.user_id,
        title: p.title,
        subtitle: `${p.mineral} · ${p.region} · ${p.licence_type} (${p.licence_reference})`,
        description: p.summary,
        valueUsd: p.investment_usd,
        status: normalizeDisplayStatus(p.status, p.approved),
        approved: Boolean(p.approved),
        isFeatured: Boolean(p.is_featured),
        rejectionReason: p.rejection_reason || p.moderation_notes || null,
        referenceCode: p.licence_reference,
        createdAt: p.created_at,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return rows.filter((row) => {
      if (oppKindFilter !== 'ALL' && row.kind !== oppKindFilter) return false
      if (oppStatusFilter !== 'ALL' && row.status !== oppStatusFilter) return false
      if (!q) return true
      const owner = profileMap.get(row.user_id)
      return (
        row.title.toLowerCase().includes(q) ||
        row.subtitle.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q) ||
        (owner?.email || '').toLowerCase().includes(q)
      )
    })
  }, [opportunities, projects, oppSearch, oppKindFilter, oppStatusFilter, profileMap])

  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      if (quoteStatusFilter === 'ALL') return true
      return normalizeDisplayStatus(q.status, q.approved) === quoteStatusFilter
    })
  }, [quotes, quoteStatusFilter])

  const distinctAuditActions = useMemo(() => {
    const s = new Set<string>()
    auditLogs.forEach((l) => s.add(l.action_type))
    return Array.from(s).sort()
  }, [auditLogs])

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase()
    return auditLogs.filter((l) => {
      if (auditActionFilter !== 'ALL' && l.action_type !== auditActionFilter) return false
      if (!q) return true
      return (
        l.action_type.toLowerCase().includes(q) ||
        (l.actor_email || '').toLowerCase().includes(q) ||
        (l.target_summary || '').toLowerCase().includes(q) ||
        l.target_table.toLowerCase().includes(q)
      )
    })
  }, [auditLogs, auditSearch, auditActionFilter])

  // Action handlers
  const handleVerifyUser = async (
    u: UserProfile,
    decision: 'VERIFY' | 'REJECT' | 'REVOKE'
  ) => {
    setBusyId(u.id)
    try {
      const res = await adminVerifyUserProfile({
        targetUserId: u.id,
        decision,
        notes: verifNotesMap[u.id],
      })
      if (res.error) {
        setFeedback({ type: 'error', message: res.error })
        return
      }
      setFeedback({
        type: 'success',
        message: `${u.email} verification updated (${decision}). Immutable audit event recorded.`,
      })
      await loadGovernanceTelemetry()
    } finally {
      setBusyId(null)
    }
  }

  const handleUpdateUser = async (
    targetUserId: string,
    updates: { role?: UserRole; status?: UserStatus }
  ) => {
    setBusyId(targetUserId)
    try {
      const res = await adminUpdateUserProfile({ targetUserId, ...updates })
      if (res.error) {
        setFeedback({ type: 'error', message: res.error })
        return
      }
      setFeedback({
        type: 'success',
        message: `Updated ${res.user?.email} (${
          updates.role ? `role → ${updates.role}` : `status → ${updates.status}`
        }).`,
      })
      await loadGovernanceTelemetry()
    } finally {
      setBusyId(null)
    }
  }

  const handleDeleteUser = async (u: UserProfile) => {
    if (!window.confirm(`Permanently remove profile ${u.email}?`)) return
    setBusyId(u.id)
    try {
      const res = await adminDeleteUserProfile(u.id)
      if (res.error) {
        setFeedback({ type: 'error', message: res.error })
        return
      }
      setFeedback({ type: 'success', message: `Deleted user profile ${u.email}.` })
      await loadGovernanceTelemetry()
    } finally {
      setBusyId(null)
    }
  }

  const handleModerate = async (params: {
    id: string
    type: 'SERVICE' | 'OPPORTUNITY' | 'PROJECT' | 'QUOTE'
    action: 'APPROVE' | 'REJECT' | 'HIDE' | 'TOGGLE_FEATURED'
    title: string
    currentFeatured?: boolean
  }) => {
    setBusyId(params.id)
    try {
      const res = await adminModerateEntity({
        id: params.id,
        type: params.type,
        action: params.action,
        reason: reasonMap[params.id],
        title: params.title,
        currentFeatured: params.currentFeatured,
      })
      if (res.error) {
        setFeedback({ type: 'error', message: res.error })
        return
      }
      setFeedback({
        type: 'success',
        message: `${params.action} applied to ${params.type} "${params.title}". Audit log recorded.`,
      })
      await loadGovernanceTelemetry()
    } finally {
      setBusyId(null)
    }
  }

  const handlePurge = async (
    id: string,
    type: 'SERVICE' | 'OPPORTUNITY' | 'PROJECT' | 'QUOTE',
    title: string
  ) => {
    if (!window.confirm(`Permanently delete ${type} "${title}"?`)) return
    setBusyId(id)
    try {
      const res = await adminPurgeContentItem({ id, type, title })
      if (res.error) {
        setFeedback({ type: 'error', message: res.error })
        return
      }
      setFeedback({ type: 'success', message: `Deleted ${type} "${title}".` })
      await loadGovernanceTelemetry()
    } finally {
      setBusyId(null)
    }
  }

  const handleSaveMineralEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMineral) return
    const res = await adminUpdateMineralPrice({
      id: editingMineral.id,
      world_market_price_usd: Number(editWorldPrice),
      local_market_price_usd: Number(editLocalPrice),
      buying_centre_price_usd: Number(editBuyingPrice),
      trend_percentage: Number(editTrendPct) || 0,
    })
    if (res.error) {
      setFeedback({ type: 'error', message: res.error })
      return
    }
    setMineralBenchmarks(getStoredMineralPrices())
    setEditingMineral(null)
    setFeedback({ type: 'success', message: `Updated ${editingMineral.mineral_name} benchmarks.` })
  }

  const handleSyncMinerals = async () => {
    const res = await adminSyncLiveMarketBenchmarks()
    if (res.error) {
      setFeedback({ type: 'error', message: res.error })
      return
    }
    setMineralBenchmarks(res.records)
    setFeedback({ type: 'success', message: `Synchronized ${res.records.length} mineral benchmarks.` })
  }

  if (authLoading || profileLoading || loadingGovernance) {
    return (
      <div className="min-h-screen bg-paper pb-24 pt-28 text-ink">
        <div className="mx-auto max-w-7xl space-y-6 px-5 lg:px-8">
          <div className="h-36 animate-pulse rounded-2xl bg-ink/10" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-ink/10" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-ink/10" />
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-paper pb-24 pt-32 text-ink">
        <div className="mx-auto max-w-xl rounded-xl border border-danger/30 bg-paper-2 p-8 text-center">
          <ShieldAlert size={40} className="mx-auto text-danger" />
          <h1 className="mt-4 font-display text-2xl font-semibold">
            401 Unauthorized — Admin Sign-In Required
          </h1>
          <p className="mt-2 text-sm text-stone">
            Sign in with a verified MineConnect administrator account to open the Governance Command Center.
          </p>
          <Link
            to="/login"
            search={{ next: '/admin', reason: 'admin_auth_required' } as unknown as undefined}
            className="btn-primary mt-6 inline-flex"
          >
            Sign In as Administrator
          </Link>
        </div>
      </div>
    )
  }

  if (!authorized || !isAdmin) {
    return (
      <div className="min-h-screen bg-paper pb-24 pt-32 text-ink">
        <div className="mx-auto max-w-xl rounded-xl border border-danger/30 bg-paper-2 p-8 text-center">
          <ShieldAlert size={40} className="mx-auto text-danger" />
          <h1 className="mt-4 font-display text-2xl font-semibold">
            403 Forbidden — Administrative Clearance Required
          </h1>
          <p className="mt-2 text-sm text-stone">
            Your account does not have administrator clearance to access this governance console.
          </p>
          {profileError && (
            <p className="mt-3 rounded border border-danger/30 bg-danger/10 px-3 py-2 font-mono text-xs text-danger">
              Profile Error: {profileError}
            </p>
          )}
          <Link to="/dashboard" className="btn-primary mt-6 inline-flex">
            Return to Member Vault
          </Link>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview & Telemetry', icon: LayoutDashboard, badge: 0 },
    { id: 'users' as const, label: 'Users & Verification', icon: Users, badge: kpis.pendingVerifications },
    { id: 'services' as const, label: 'Services Moderation', icon: Wrench, badge: kpis.pendingServices },
    {
      id: 'opportunities' as const,
      label: 'Opportunities & Projects',
      icon: Compass,
      badge: kpis.pendingOpportunities + kpis.pendingProjects,
    },
    { id: 'quotes_audit' as const, label: 'Quotes & Audit Trail', icon: Activity, badge: kpis.pendingQuotes },
    { id: 'minerals' as const, label: 'Mineral Prices', icon: Coins, badge: 0 },
  ]

  return (
    <div
      data-currency={currency}
      data-language={language}
      className="min-h-screen bg-paper pb-24 pt-28 text-ink"
    >
      <div className="mx-auto max-w-7xl space-y-6 px-5 lg:px-8">
        {/* Executive Command Header */}
        <header className="rounded-xl border border-ink/15 bg-ink p-6 text-paper shadow-sm lg:p-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-moss/30 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-gold">
                  <ShieldCheck size={14} />
                  Zero-Trust Admin Command Center
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-paper/10 px-3 py-1 font-mono text-[11px] text-paper/80">
                  DB Latency: {dbLatencyMs}ms · {currencyMeta.flag} {currency} ({rateForSelected.toFixed(2)})
                </span>
              </div>
              <h1 className="mt-3 font-display text-3xl font-semibold">
                {ui(
                  'MineConnect Platform Governance & Moderation',
                  'Kituo cha Udhibiti na Uhakiki cha MineConnect',
                  'Centro de Gobernanza y Moderación MineConnect'
                )}
              </h1>
              <p className="mt-1 text-sm text-paper/75">
                Signed in as <span className="font-mono text-gold">{session.user.email}</span> · Full real-time oversight over user verification, marketplace approvals, quotes, and immutable audit logs.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <CurrencySwitcher dark />
              <LanguageSwitcher dark />
              <button
                type="button"
                onClick={() => void loadGovernanceTelemetry()}
                className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-ochre/20 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gold transition hover:bg-ochre/30"
              >
                <RefreshCw size={14} />
                Refresh Live DB
              </button>
            </div>
          </div>

          {/* 5 Primary Governance Tabs + Mineral Utility */}
          <nav className="mt-6 flex flex-wrap gap-2 border-t border-paper/10 pt-5" aria-label="Admin sections">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                    active
                      ? 'border-gold bg-gold text-ink shadow-sm'
                      : 'border-paper/15 bg-paper/5 text-paper/80 hover:bg-paper/15 hover:text-paper'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                  {tab.badge > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                        active ? 'bg-ink text-gold' : 'bg-ochre text-paper'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </header>

        {/* Feedback / Toast Banner */}
        {feedback && (
          <div
            role="status"
            className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-xs font-medium ${
              feedback.type === 'success'
                ? 'border-moss/40 bg-moss-light text-moss'
                : 'border-danger/40 bg-danger/10 text-danger'
            }`}
          >
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="font-mono text-[11px] underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: OVERVIEW & LIVE TELEMETRY */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'Total Users', value: kpis.totalUsers, tab: 'users' as const, accent: 'text-ink' },
                { label: 'Verified Users', value: kpis.verifiedUsers, tab: 'users' as const, accent: 'text-moss' },
                { label: 'Pending Verifications', value: kpis.pendingVerifications, tab: 'users' as const, accent: 'text-ochre' },
                { label: 'Pending Services', value: kpis.pendingServices, tab: 'services' as const, accent: 'text-ochre' },
                {
                  label: 'Pending Opps & Projects',
                  value: kpis.pendingOpportunities + kpis.pendingProjects,
                  tab: 'opportunities' as const,
                  accent: 'text-ochre',
                },
                { label: 'Pending Quotes', value: kpis.pendingQuotes, tab: 'quotes_audit' as const, accent: 'text-ochre' },
              ].map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={() => setActiveTab(card.tab)}
                  className="rounded-xl border border-ink/15 bg-white p-4 text-left shadow-xs transition duration-150 hover:border-ochre/50 hover:shadow-sm"
                >
                  <div className="font-mono text-[10px] uppercase tracking-wider text-stone">
                    {card.label}
                  </div>
                  <div className={`mt-2 font-display text-3xl font-semibold tabular-nums ${card.accent}`}>
                    {card.value}
                  </div>
                </button>
              ))}
            </div>

            {/* Live Recent Platform Activity Feed */}
            <section className="rounded-2xl border border-ink/12 bg-white/80 p-6">
              <div className="flex items-center justify-between border-b border-ink/10 pb-4">
                <div>
                  <h2 className="font-display text-xl font-semibold">
                    Live Platform Activity Feed (`public.admin_audit_logs`)
                  </h2>
                  <p className="text-xs text-stone">
                    Real-time immutable stream of sign-ups, uploads, user verifications, and admin decisions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('quotes_audit')}
                  className="font-mono text-xs font-semibold text-ochre hover:underline"
                >
                  Open Full Audit Ledger →
                </button>
              </div>

              {auditLogs.length === 0 ? (
                <p className="py-10 text-center text-sm text-stone">
                  No activity recorded yet. New sign-ups, submissions, and admin actions appear here immediately.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-ink/8">
                  {auditLogs.slice(0, 12).map((log) => (
                    <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold ${auditBadgeClasses(log.action_type)}`}>
                          {log.action_type}
                        </span>
                        <span className="font-semibold text-ink">{log.target_summary || log.target_table}</span>
                        <span className="font-mono text-[11px] text-stone">
                          by {log.actor_email || log.actor_id?.slice(0, 8) || 'system'}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-stone">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: USER MANAGEMENT & IDENTITY VERIFICATION */}
        {activeTab === 'users' && (
          <section className="rounded-2xl border border-ink/12 bg-white/85 p-6 space-y-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="font-display text-2xl font-semibold">
                  User Directory &amp; Identity Verification ({filteredUsers.length} / {users.length})
                </h2>
                <p className="text-xs text-stone">
                  Verify member identities (`public.profiles.verification_status`), manage roles, or suspend accounts.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone" />
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search email, name, company..."
                    className="field !py-1.5 !pl-8 !text-xs"
                  />
                </div>
                <select
                  value={userVerifFilter}
                  onChange={(e) => setUserVerifFilter(e.target.value as typeof userVerifFilter)}
                  className="field !w-auto !py-1.5 !text-xs"
                >
                  <option value="ALL">All Users</option>
                  <option value="pending">Pending Verification</option>
                  <option value="verified">Verified</option>
                  <option value="unverified">Unverified</option>
                  <option value="rejected">Rejected</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {filteredUsers.map((u) => {
                const isSelf = u.id === session.user.id
                const verifStatus = u.verification_status || 'unverified'
                return (
                  <div
                    key={u.id}
                    className="rounded-xl border border-ink/12 bg-paper/60 p-4 transition hover:border-ochre/40"
                  >
                    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-base font-semibold text-ink">
                            {u.full_name || 'Unnamed Member'}
                          </span>
                          {verifStatus === 'verified' && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-moss/40 bg-moss-light px-2 py-0.5 font-mono text-[10px] font-semibold text-moss">
                              <BadgeCheck size={11} /> Verified
                            </span>
                          )}
                          {verifStatus !== 'verified' && (
                            <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${verificationBadgeClasses(verifStatus)}`}>
                              {verifStatus}
                            </span>
                          )}
                          <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase ${u.role === 'admin' ? 'border-gold/60 bg-ink text-gold' : 'border-ink/15 bg-white text-stone'}`}>
                            {u.role}
                          </span>
                          {u.status === 'suspended' && (
                            <span className="rounded-full border border-danger/40 bg-danger/15 px-2 py-0.5 font-mono text-[10px] uppercase text-danger">
                              Suspended
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-xs text-stone">
                          {u.email}
                          {u.company_name ? ` · ${u.company_name}` : ''}
                          {u.phone ? ` · ${u.phone}` : ''}
                          {` · Joined ${new Date(u.created_at).toLocaleDateString()}`}
                        </p>
                        {u.verification_notes && (
                          <p className="text-xs text-ink/75">
                            Verification Note: <span className="italic">{u.verification_notes}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={verifNotesMap[u.id] ?? ''}
                          onChange={(e) =>
                            setVerifNotesMap((prev) => ({ ...prev, [u.id]: e.target.value }))
                          }
                          placeholder="Verification note..."
                          className="field !w-44 !py-1 !text-xs"
                        />
                        {verifStatus !== 'verified' ? (
                          <button
                            type="button"
                            disabled={busyId === u.id}
                            onClick={() => void handleVerifyUser(u, 'VERIFY')}
                            className="inline-flex items-center gap-1 rounded-md bg-moss px-2.5 py-1.5 text-xs font-semibold text-paper hover:opacity-90 disabled:opacity-50"
                          >
                            <UserCheck size={13} /> Verify
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === u.id}
                            onClick={() => void handleVerifyUser(u, 'REVOKE')}
                            className="inline-flex items-center gap-1 rounded-md border border-ink/20 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone hover:text-ink disabled:opacity-50"
                          >
                            <ShieldOff size={13} /> Revoke
                          </button>
                        )}
                        {verifStatus === 'pending' && (
                          <button
                            type="button"
                            disabled={busyId === u.id}
                            onClick={() => void handleVerifyUser(u, 'REJECT')}
                            className="inline-flex items-center gap-1 rounded-md border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20 disabled:opacity-50"
                          >
                            <XCircle size={13} /> Reject
                          </button>
                        )}
                        {!isSelf && (
                          <>
                            <button
                              type="button"
                              disabled={busyId === u.id}
                              onClick={() =>
                                void handleUpdateUser(u.id, {
                                  role: u.role === 'admin' ? 'user' : 'admin',
                                })
                              }
                              className="rounded-md border border-ink/20 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-ochre"
                            >
                              {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === u.id}
                              onClick={() =>
                                void handleUpdateUser(u.id, {
                                  status: u.status === 'suspended' ? 'active' : 'suspended',
                                })
                              }
                              className="rounded-md border border-ochre/40 bg-ochre/10 px-2.5 py-1.5 text-xs font-semibold text-ochre hover:bg-ochre/20"
                            >
                              {u.status === 'suspended' ? 'Activate' : 'Suspend'}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === u.id}
                              onClick={() => void handleDeleteUser(u)}
                              className="rounded-md border border-danger/30 p-1.5 text-danger hover:bg-danger/10"
                              title="Delete profile"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* TAB 3: SERVICES MODERATION & VISIBILITY CONTROL */}
        {activeTab === 'services' && (
          <section className="rounded-2xl border border-ink/12 bg-white/85 p-6 space-y-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="font-display text-2xl font-semibold">
                  Services Moderation &amp; Public Visibility ({filteredServices.length})
                </h2>
                <p className="text-xs text-stone">
                  Only <strong>Approved</strong> services appear publicly on `/services`. Toggle Featured or Hide anytime.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="search"
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  placeholder="Search services..."
                  className="field !w-56 !py-1.5 !text-xs"
                />
                <select
                  value={serviceStatusFilter}
                  onChange={(e) => setServiceStatusFilter(e.target.value as typeof serviceStatusFilter)}
                  className="field !w-auto !py-1.5 !text-xs"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </div>

            {filteredServices.length === 0 ? (
              <p className="py-12 text-center text-sm text-stone">No service submissions match this filter.</p>
            ) : (
              <div className="space-y-4">
                {filteredServices.map((s) => {
                  const owner = profileMap.get(s.user_id)
                  const norm = normalizeDisplayStatus(s.status, s.approved)
                  return (
                    <article key={s.id} className="rounded-xl border border-ink/12 bg-paper/60 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${statusPillClasses(norm)}`}>
                              {norm}
                            </span>
                            {s.is_featured && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 font-mono text-[10px] font-semibold text-ochre">
                                <Star size={11} className="fill-gold text-gold" /> Featured
                              </span>
                            )}
                            <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] text-gold">
                              {s.reference_code}
                            </span>
                            <span className="font-mono text-[11px] text-ochre">{s.expertise_area}</span>
                          </div>
                          <h3 className="mt-2 font-display text-lg font-semibold">{s.service_name}</h3>
                          <p className="text-xs text-stone">
                            Provider: <strong>{s.provider_organization}</strong> · Rate: {s.rate_or_pricing_model} (<PriceDisplay amountInUSD={s.estimated_rate_usd} />)
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-stone">
                            Submitted by: {owner?.full_name || 'Member'} ({owner?.email || s.user_id.slice(0, 8)})
                            {owner?.verification_status === 'verified' && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 text-moss font-semibold">
                                · ✓ Verified User
                              </span>
                            )}
                          </p>
                          <p className="mt-2 text-xs text-ink/80">{s.scope_description}</p>
                          {(s.rejection_reason || s.moderation_notes) && (
                            <p className="mt-2 rounded border border-ink/10 bg-white px-2.5 py-1 text-[11px] text-stone">
                              Note: {s.rejection_reason || s.moderation_notes}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={reasonMap[s.id] ?? ''}
                            onChange={(e) => setReasonMap((p) => ({ ...p, [s.id]: e.target.value }))}
                            placeholder="Reason / note..."
                            className="field !w-44 !py-1 !text-xs"
                          />
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() =>
                              void handleModerate({
                                id: s.id,
                                type: 'SERVICE',
                                action: 'APPROVE',
                                title: s.service_name,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-md bg-moss px-3 py-1.5 text-xs font-semibold text-paper hover:opacity-90"
                          >
                            <CheckCircle2 size={13} /> Approve &amp; Publish
                          </button>
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() =>
                              void handleModerate({
                                id: s.id,
                                type: 'SERVICE',
                                action: 'REJECT',
                                title: s.service_name,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20"
                          >
                            <XCircle size={13} /> Reject
                          </button>
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() =>
                              void handleModerate({
                                id: s.id,
                                type: 'SERVICE',
                                action: 'HIDE',
                                title: s.service_name,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-ink/20 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone hover:text-ink"
                          >
                            <EyeOff size={13} /> Hide
                          </button>
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() =>
                              void handleModerate({
                                id: s.id,
                                type: 'SERVICE',
                                action: 'TOGGLE_FEATURED',
                                title: s.service_name,
                                currentFeatured: Boolean(s.is_featured),
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-gold/60 bg-gold/15 px-2.5 py-1.5 text-xs font-semibold text-ochre"
                          >
                            <Star size={13} /> {s.is_featured ? 'Unfeature' : 'Feature'}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() => void handlePurge(s.id, 'SERVICE', s.service_name)}
                            className="rounded-md border border-danger/30 p-1.5 text-danger hover:bg-danger/10"
                            title="Delete service"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 4: OPPORTUNITIES & PROJECTS TRACKING */}
        {activeTab === 'opportunities' && (
          <section className="rounded-2xl border border-ink/12 bg-white/85 p-6 space-y-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="font-display text-2xl font-semibold">
                  Opportunities &amp; Project Listings ({combinedOppAndProjects.length})
                </h2>
                <p className="text-xs text-stone">
                  Approve to publish immediately on `/opportunities`, reject with reason, or hide from public view.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="search"
                  value={oppSearch}
                  onChange={(e) => setOppSearch(e.target.value)}
                  placeholder="Search title, mineral, submitter..."
                  className="field !w-52 !py-1.5 !text-xs"
                />
                <select
                  value={oppKindFilter}
                  onChange={(e) => setOppKindFilter(e.target.value as typeof oppKindFilter)}
                  className="field !w-auto !py-1.5 !text-xs"
                >
                  <option value="ALL">Opportunities &amp; Projects</option>
                  <option value="OPPORTUNITY">Opportunities Only</option>
                  <option value="PROJECT">Projects Only</option>
                </select>
                <select
                  value={oppStatusFilter}
                  onChange={(e) => setOppStatusFilter(e.target.value as typeof oppStatusFilter)}
                  className="field !w-auto !py-1.5 !text-xs"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </div>

            {combinedOppAndProjects.length === 0 ? (
              <p className="py-12 text-center text-sm text-stone">No opportunities or projects match this filter.</p>
            ) : (
              <div className="space-y-4">
                {combinedOppAndProjects.map((item) => {
                  const owner = profileMap.get(item.user_id)
                  return (
                    <article key={`${item.kind}-${item.id}`} className="rounded-xl border border-ink/12 bg-paper/60 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="max-w-2xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold text-gold">
                              {item.kind}
                            </span>
                            <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${statusPillClasses(item.status)}`}>
                              {item.status}
                            </span>
                            {item.isFeatured && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 font-mono text-[10px] font-semibold text-ochre">
                                <Star size={11} className="fill-gold text-gold" /> Featured
                              </span>
                            )}
                            <span className="font-mono text-[11px] text-stone">
                              {new Date(item.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <h3 className="mt-2 font-display text-lg font-semibold">{item.title}</h3>
                          <p className="text-xs text-ochre">{item.subtitle}</p>
                          <p className="mt-1 font-mono text-[11px] text-stone">
                            Submitted by: {owner?.full_name || 'Member'} ({owner?.email || item.user_id.slice(0, 8)})
                            {owner?.verification_status === 'verified' && (
                              <span className="ml-1.5 font-semibold text-moss">· ✓ Verified User</span>
                            )}
                            {item.valueUsd > 0 && (
                              <> · Est. Value: <PriceDisplay amountInUSD={item.valueUsd} /></>
                            )}
                          </p>
                          <p className="mt-2 text-xs text-ink/80">{item.description}</p>
                          {item.rejectionReason && (
                            <p className="mt-2 rounded border border-ink/10 bg-white px-2.5 py-1 text-[11px] text-stone">
                              Note: {item.rejectionReason}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={reasonMap[item.id] ?? ''}
                            onChange={(e) => setReasonMap((p) => ({ ...p, [item.id]: e.target.value }))}
                            placeholder="Rejection reason / note..."
                            className="field !w-44 !py-1 !text-xs"
                          />
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() =>
                              void handleModerate({
                                id: item.id,
                                type: item.kind,
                                action: 'APPROVE',
                                title: item.title,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-md bg-moss px-3 py-1.5 text-xs font-semibold text-paper hover:opacity-90"
                          >
                            <CheckCircle2 size={13} /> Approve
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() =>
                              void handleModerate({
                                id: item.id,
                                type: item.kind,
                                action: 'REJECT',
                                title: item.title,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20"
                          >
                            <XCircle size={13} /> Reject
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() =>
                              void handleModerate({
                                id: item.id,
                                type: item.kind,
                                action: 'HIDE',
                                title: item.title,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-ink/20 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone hover:text-ink"
                          >
                            <EyeOff size={13} /> Hide
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() =>
                              void handleModerate({
                                id: item.id,
                                type: item.kind,
                                action: 'TOGGLE_FEATURED',
                                title: item.title,
                                currentFeatured: item.isFeatured,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-gold/60 bg-gold/15 px-2.5 py-1.5 text-xs font-semibold text-ochre"
                          >
                            <Star size={13} /> {item.isFeatured ? 'Unfeature' : 'Feature'}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void handlePurge(item.id, item.kind, item.title)}
                            className="rounded-md border border-danger/30 p-1.5 text-danger hover:bg-danger/10"
                            title="Delete item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 5: QUOTES & IMMUTABLE SYSTEM ACTIVITY AUDIT LOG */}
        {activeTab === 'quotes_audit' && (
          <div className="space-y-6">
            {/* Quote Requests Moderation */}
            <section className="rounded-2xl border border-ink/12 bg-white/85 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-semibold">
                    Service Quote Requests ({filteredQuotes.length})
                  </h2>
                  <p className="text-xs text-stone">Review, approve, reject, or close member quote requests (`public.quotes`).</p>
                </div>
                <select
                  value={quoteStatusFilter}
                  onChange={(e) => setQuoteStatusFilter(e.target.value as typeof quoteStatusFilter)}
                  className="field !w-auto !py-1.5 !text-xs"
                >
                  <option value="ALL">All Quotes</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved / Quoted</option>
                  <option value="rejected">Rejected</option>
                  <option value="hidden">Closed</option>
                </select>
              </div>

              {filteredQuotes.length === 0 ? (
                <p className="py-8 text-center text-sm text-stone">No quote requests found.</p>
              ) : (
                <div className="space-y-3">
                  {filteredQuotes.map((q) => {
                    const owner = profileMap.get(q.user_id)
                    const norm = normalizeDisplayStatus(q.status, q.approved)
                    return (
                      <div key={q.id} className="rounded-xl border border-ink/12 bg-paper/60 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${statusPillClasses(norm)}`}>
                                {norm}
                              </span>
                              <span className="font-mono text-xs font-semibold text-ochre">
                                Provider: {q.provider_name}
                              </span>
                              <span className="font-mono text-[11px] text-stone">
                                Budget: <PriceDisplay amountInUSD={q.estimated_budget_usd} />
                              </span>
                            </div>
                            <h3 className="mt-1.5 font-display text-base font-semibold">{q.service_requested}</h3>
                            <p className="font-mono text-[11px] text-stone">
                              Requested by {owner?.full_name || 'Member'} ({owner?.email || q.user_id.slice(0, 8)}) · {new Date(q.created_at).toLocaleString()}
                            </p>
                            <p className="mt-1.5 text-xs text-ink/80">{q.scope_notes}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={reasonMap[q.id] ?? ''}
                              onChange={(e) => setReasonMap((p) => ({ ...p, [q.id]: e.target.value }))}
                              placeholder="Note / reason..."
                              className="field !w-40 !py-1 !text-xs"
                            />
                            <button
                              type="button"
                              disabled={busyId === q.id}
                              onClick={() =>
                                void handleModerate({
                                  id: q.id,
                                  type: 'QUOTE',
                                  action: 'APPROVE',
                                  title: q.service_requested,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-md bg-moss px-2.5 py-1.5 text-xs font-semibold text-paper"
                            >
                              <CheckCircle2 size={13} /> Approve
                            </button>
                            <button
                              type="button"
                              disabled={busyId === q.id}
                              onClick={() =>
                                void handleModerate({
                                  id: q.id,
                                  type: 'QUOTE',
                                  action: 'REJECT',
                                  title: q.service_requested,
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-md border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger"
                            >
                              <XCircle size={13} /> Reject
                            </button>
                            <button
                              type="button"
                              disabled={busyId === q.id}
                              onClick={() => void handlePurge(q.id, 'QUOTE', q.service_requested)}
                              className="rounded-md border border-danger/30 p-1.5 text-danger hover:bg-danger/10"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Immutable Activity & Governance Audit Trail */}
            <section className="rounded-2xl border border-ink/12 bg-white/85 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-semibold">
                    Immutable System Activity &amp; Audit Trail ({filteredAuditLogs.length})
                  </h2>
                  <p className="text-xs text-stone">
                    Append-only PostgreSQL security ledger (`public.admin_audit_logs`). UPDATE and DELETE are blocked for all roles.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="search"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Filter actor, action, target..."
                    className="field !w-52 !py-1.5 !text-xs"
                  />
                  <select
                    value={auditActionFilter}
                    onChange={(e) => setAuditActionFilter(e.target.value)}
                    className="field !w-auto !py-1.5 !text-xs"
                  >
                    <option value="ALL">All Actions</option>
                    {distinctAuditActions.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-ink/10">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="border-b border-ink/10 bg-paper-2 font-mono text-[10px] uppercase tracking-wider text-stone">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Table</th>
                      <th className="px-4 py-3">Target Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/8">
                    {filteredAuditLogs.slice(0, 100).map((log) => (
                      <tr key={log.id} className="hover:bg-paper/50">
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-stone">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold ${auditBadgeClasses(log.action_type)}`}>
                            {log.action_type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px]">
                          {log.actor_email || log.actor_id?.slice(0, 8) || 'system'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-stone">
                          {log.target_table}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-ink">
                          {log.target_summary || log.target_id || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB 6: MINERAL PRICES BENCHMARK GOVERNANCE */}
        {activeTab === 'minerals' && (
          <section className="rounded-2xl border border-ink/12 bg-white/85 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold">
                  Indicative Mineral Price Benchmarks (`public.mineral_prices`)
                </h2>
                <p className="text-xs text-stone">Manage LBMA/LME &amp; Tume ya Madini statutory pricing tiers.</p>
              </div>
              <button
                type="button"
                onClick={() => void handleSyncMinerals()}
                className="btn-primary !py-2 !px-4 text-xs"
              >
                <RefreshCw size={13} /> Sync Live Market Benchmarks
              </button>
            </div>

            {editingMineral && (
              <form onSubmit={handleSaveMineralEdit} className="grid gap-3 rounded-xl border border-ochre/40 bg-paper p-4 sm:grid-cols-5">
                <div className="sm:col-span-5 font-display text-base font-semibold">
                  Editing {editingMineral.mineral_name} ({editingMineral.symbol})
                </div>
                <input value={editWorldPrice} onChange={(e) => setEditWorldPrice(e.target.value)} placeholder="World USD" className="field !text-xs" />
                <input value={editLocalPrice} onChange={(e) => setEditLocalPrice(e.target.value)} placeholder="Local USD" className="field !text-xs" />
                <input value={editBuyingPrice} onChange={(e) => setEditBuyingPrice(e.target.value)} placeholder="Buying USD" className="field !text-xs" />
                <input value={editTrendPct} onChange={(e) => setEditTrendPct(e.target.value)} placeholder="Trend %" className="field !text-xs" />
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary !py-1.5 !px-3 text-xs">Save</button>
                  <button type="button" onClick={() => setEditingMineral(null)} className="rounded border border-ink/20 px-3 text-xs">Cancel</button>
                </div>
              </form>
            )}

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {mineralBenchmarks.map((m) => (
                <div key={m.id} className="rounded-xl border border-ink/12 bg-paper/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-semibold">{m.mineral_name}</span>
                    <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] text-gold">{m.symbol}</span>
                  </div>
                  <div className="mt-2 space-y-1 font-mono text-xs text-stone">
                    <div>World: <strong className="text-ink">${m.world_market_price_usd}</strong></div>
                    <div>Soko la Madini: <strong className="text-ink">${m.local_market_price_usd}</strong></div>
                    <div>Buying Centre: <strong className="text-ink">${m.buying_centre_price_usd}</strong></div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMineral(m)
                      setEditWorldPrice(String(m.world_market_price_usd))
                      setEditLocalPrice(String(m.local_market_price_usd))
                      setEditBuyingPrice(String(m.buying_centre_price_usd))
                      setEditTrendPct(String(m.trend_percentage))
                    }}
                    className="mt-3 rounded border border-ink/20 bg-white px-2.5 py-1 text-xs font-semibold text-ochre hover:border-ochre"
                  >
                    Edit Rates
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick Icon Legend / Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone">
          <span className="inline-flex items-center gap-1.5">
            <Briefcase size={13} /> All moderation changes are enforced server-side and recorded in the immutable audit trail.
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono">
            <FileText size={13} /> <Clock size={13} /> Live Supabase Sync Active
          </span>
        </div>
      </div>
    </div>
  )
}
