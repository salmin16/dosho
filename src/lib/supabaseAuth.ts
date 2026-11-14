import { useEffect, useState } from 'react'
import type {
  AuditAction,
  AuditLog,
  ContentStatus,
  DocumentClassification,
  OpportunitySubmissionCategory,
  QuoteRequestRecord,
  ServiceExpertiseArea,
  SupportedCurrency,
  UnifiedContentRecord,
  UnifiedContentType,
  UserDocument,
  UserListedProject,
  UserOpportunityRecord,
  UserProfile,
  UserRole,
  UserServiceRecord,
  UserStatus,
} from '../types/database'

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: UserRole
  status: UserStatus
  preferredCurrency?: SupportedCurrency
  createdAt: string
}

export interface AuthSession {
  accessToken: string
  user: AuthUser
  mode: 'supabase' | 'grounded-local'
}

const SESSION_KEY = 'mineconnect.auth.session.v1'
const USERS_KEY = 'mineconnect.auth.users.v1'
const PROFILES_KEY = 'mineconnect.db.user_profiles.v1'
const DOCUMENTS_KEY = 'mineconnect.db.user_documents.v1'
const PROJECTS_KEY = 'mineconnect.db.user_projects.v1'
const QUOTES_KEY = 'mineconnect.db.quote_requests.v1'
const OPPORTUNITIES_KEY = 'mineconnect.db.opportunities.v1'
const SERVICES_KEY = 'mineconnect.db.services.v1'
const AUDIT_LOGS_KEY = 'mineconnect.db.audit_logs.v1'
const SEED_VERSION_KEY = 'mineconnect.db.seed_version.v2'
const AUTH_EVENT = 'mineconnect:auth-changed'

interface StoredAccount {
  id: string
  email: string
  fullName: string
  passwordHash: string
  role: UserRole
  status: UserStatus
  preferredCurrency?: SupportedCurrency
  createdAt: string
}

function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env || {}
  const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (url && anonKey && !url.includes('your-project-id')) {
    return { url: url.replace(/\/$/, ''), anonKey }
  }
  return null
}

async function sha256(input: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  return btoa(input)
}

function generateUuid(): string {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Ensures initial seed profiles, documents, pending project submissions, quote requests,
 * and audit logs exist so the Master Control & Oversight Module has rich, realistic data immediately.
 */
function ensureSeedGovernanceData() {
  if (typeof window === 'undefined') return
  try {
    const seededV2 = window.localStorage.getItem(SEED_VERSION_KEY)
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000

    const rawProfiles = window.localStorage.getItem(PROFILES_KEY)
    const profiles: UserProfile[] = rawProfiles ? JSON.parse(rawProfiles) : []
    if (profiles.length < 4 || !seededV2) {
      const defaultProfiles: UserProfile[] = [
        {
          id: '00000000-0000-4000-8000-000000000001',
          email: 'admin@mineconnect.co.tz',
          full_name: 'Salmin Mwenesi (Chief Security Architect)',
          role: 'admin',
          status: 'active',
          preferred_currency: 'USD',
          created_at: new Date(now - 6 * dayMs).toISOString(),
          updated_at: new Date(now - 1 * dayMs).toISOString(),
        },
        {
          id: '00000000-0000-4000-8000-000000000002',
          email: 'geology.director@tanzaniagold.co.tz',
          full_name: 'Dr. Amani Nyerere',
          role: 'user',
          status: 'active',
          preferred_currency: 'TZS',
          created_at: new Date(now - 4 * dayMs).toISOString(),
          updated_at: new Date(now - 2 * dayMs).toISOString(),
        },
        {
          id: '00000000-0000-4000-8000-000000000003',
          email: 'investments@kilimanjaromineral.co.uk',
          full_name: 'Eleanor Vance (VP Acquisitions)',
          role: 'user',
          status: 'active',
          preferred_currency: 'GBP',
          created_at: new Date(now - 2 * dayMs).toISOString(),
          updated_at: new Date(now - 1 * dayMs).toISOString(),
        },
        {
          id: '00000000-0000-4000-8000-000000000004',
          email: 'compliance.audit@mererani-gems.co.tz',
          full_name: 'Juma Mwinyi (Operations Lead)',
          role: 'user',
          status: 'active',
          preferred_currency: 'EUR',
          created_at: new Date(now - 12 * 3600 * 1000).toISOString(),
          updated_at: new Date(now - 2 * 3600 * 1000).toISOString(),
        },
        {
          id: '00000000-0000-4000-8000-000000000005',
          email: 'flagged.broker@unverified-syndicate.org',
          full_name: 'Viktor K. (Suspended Broker)',
          role: 'user',
          status: 'suspended',
          preferred_currency: 'USD',
          created_at: new Date(now - 5 * dayMs).toISOString(),
          updated_at: new Date(now - 3 * dayMs).toISOString(),
        },
      ]

      const existingIds = new Set(profiles.map((p) => p.id))
      for (const dp of defaultProfiles) {
        if (!existingIds.has(dp.id)) {
          profiles.push(dp)
        }
      }
      window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
    }

    const rawProjects = window.localStorage.getItem(PROJECTS_KEY)
    const projects: UserListedProject[] = rawProjects ? JSON.parse(rawProjects) : []
    if (projects.length === 0 || !seededV2) {
      const seedProjects: UserListedProject[] = [
        {
          id: 'proj-seed-001',
          user_id: '00000000-0000-4000-8000-000000000002',
          title: 'Kahama South-East Shear Zone Gold JV',
          mineral: 'Gold',
          region: 'Shinyanga',
          licence_type: 'PL (Prospecting Licence)',
          licence_reference: 'PL/11842/2025',
          investment_usd: 1850000,
          submitted_currency: 'USD',
          summary:
            '24.6 sq km prospecting licence bordering major Lake Victoria Greenstone Belt producer. 1,400m RC drilling completed with 4.2g/t Au intercepts. Awaiting L2 licence cadastre verification.',
          status: 'PENDING_VERIFICATION',
          approved: false,
          moderation_notes: null,
          created_at: new Date(now - 18 * 3600 * 1000).toISOString(),
          updated_at: new Date(now - 18 * 3600 * 1000).toISOString(),
        },
        {
          id: 'proj-seed-002',
          user_id: '00000000-0000-4000-8000-000000000004',
          title: 'Mererani Block D Deep Tanzanite Shaft Expansion',
          mineral: 'Tanzanite',
          region: 'Manyara',
          licence_type: 'PML (Primary Mining Licence)',
          licence_reference: 'PML/009412/MANYARA',
          investment_usd: 620000,
          submitted_currency: 'TZS',
          summary:
            'Active underground gemstone operation seeking mechanized ventilation, hoist upgrade, and optical sorting equipment partner. Full environmental permit attached.',
          status: 'PENDING_VERIFICATION',
          approved: false,
          moderation_notes: null,
          created_at: new Date(now - 7 * 3600 * 1000).toISOString(),
          updated_at: new Date(now - 7 * 3600 * 1000).toISOString(),
        },
        {
          id: 'proj-seed-003',
          user_id: '00000000-0000-4000-8000-000000000003',
          title: 'Mahenge Flake Graphite Concentrate Offtake & Equity',
          mineral: 'Graphite',
          region: 'Morogoro',
          licence_type: 'ML (Special Mining Licence)',
          licence_reference: 'ML/0619/2024',
          investment_usd: 4500000,
          submitted_currency: 'GBP',
          summary:
            'JORC-compliant 97.4% TGC large-flake graphite deposit in Ulanga District. Verified L3 geological & title package cleared by compliance team.',
          status: 'VERIFIED',
          approved: true,
          moderation_notes: 'Licence ownership & GST assay certificates verified.',
          reviewed_by: '00000000-0000-4000-8000-000000000001',
          reviewed_at: new Date(now - 2 * dayMs).toISOString(),
          created_at: new Date(now - 3 * dayMs).toISOString(),
          updated_at: new Date(now - 2 * dayMs).toISOString(),
        },
      ]
      const existingProjIds = new Set(projects.map((p) => p.id))
      for (const sp of seedProjects) {
        if (!existingProjIds.has(sp.id)) {
          projects.push(sp)
        }
      }
      window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
    }

    const rawDocs = window.localStorage.getItem(DOCUMENTS_KEY)
    const docs: UserDocument[] = rawDocs ? JSON.parse(rawDocs) : []
    if (docs.length < 3 || !seededV2) {
      const seedDocs: UserDocument[] = [
        {
          id: 'doc-seed-001',
          user_id: '00000000-0000-4000-8000-000000000002',
          title: 'SGS Mwanza Fire Assay Certificate — Batch #TZ-8841',
          content:
            'Certified laboratory fire assay results for 48 core samples from Drillhole KHM-DD-04. Peak interval: 6.0m @ 5.84 g/t Au from 74m depth. Submitted for L3 Geological Verification badge.',
          classification: 'CONFIDENTIAL',
          status: 'pending',
          approved: false,
          moderation_notes: null,
          created_at: new Date(now - 9 * 3600 * 1000).toISOString(),
          updated_at: new Date(now - 9 * 3600 * 1000).toISOString(),
        },
        {
          id: 'doc-seed-002',
          user_id: '00000000-0000-4000-8000-000000000003',
          title: 'Ulanga Graphite Environmental Impact Assessment (NEMC Certificate)',
          content:
            'Approved National Environment Management Council (NEMC) EIA certificate #EC/EIS/2025/0419 covering open-pit extraction and tailings storage facility.',
          classification: 'INTERNAL',
          status: 'active',
          approved: true,
          moderation_notes: 'Verified against NEMC registry.',
          created_at: new Date(now - 3 * dayMs).toISOString(),
          updated_at: new Date(now - 2 * dayMs).toISOString(),
        },
        {
          id: 'doc-seed-003',
          user_id: '00000000-0000-4000-8000-000000000005',
          title: 'Unverified Alluvial Gold Export Mandate Claim',
          content:
            'Purported 500kg doré bar spot offer without valid Mining Commission export permit or dealer licence reference. Flagged by automated compliance rules.',
          classification: 'RESTRICTED',
          status: 'flagged',
          approved: false,
          moderation_notes: 'Flagged: Missing Mining Commission Dealer Licence.',
          created_at: new Date(now - 4 * dayMs).toISOString(),
          updated_at: new Date(now - 3 * dayMs).toISOString(),
        },
      ]
      const existingDocIds = new Set(docs.map((d) => d.id))
      for (const sd of seedDocs) {
        if (!existingDocIds.has(sd.id)) {
          docs.push(sd)
        }
      }
      window.localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(docs))
    }

    const rawQuotes = window.localStorage.getItem(QUOTES_KEY)
    const quotes: QuoteRequestRecord[] = rawQuotes ? JSON.parse(rawQuotes) : []
    if (quotes.length === 0 || !seededV2) {
      const seedQuotes: QuoteRequestRecord[] = [
        {
          id: 'quote-seed-001',
          user_id: '00000000-0000-4000-8000-000000000002',
          provider_id: 'prv-1',
          provider_name: 'Victoria GeoConsult & Drilling Ltd',
          service_requested: 'Diamond Core Drilling (2,500m NQ) & Downhole Survey',
          estimated_budget_usd: 340000,
          currency_code: 'TZS',
          scope_notes:
            'Requesting mobilization quote to Kahama site in Q2. Includes core orientation, logging shed setup, and QA/QC sample prep.',
          status: 'SUBMITTED',
          approved: false,
          moderation_notes: null,
          created_at: new Date(now - 5 * 3600 * 1000).toISOString(),
        },
      ]
      const existingQuoteIds = new Set(quotes.map((q) => q.id))
      for (const sq of seedQuotes) {
        if (!existingQuoteIds.has(sq.id)) {
          quotes.push(sq)
        }
      }
      window.localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes))
    }

    const rawOpportunities = window.localStorage.getItem(OPPORTUNITIES_KEY)
    const opportunities: UserOpportunityRecord[] = rawOpportunities
      ? JSON.parse(rawOpportunities)
      : []
    if (opportunities.length === 0) {
      const seedOpportunities: UserOpportunityRecord[] = [
        {
          id: 'opp-seed-001',
          user_id: '00000000-0000-4000-8000-000000000002',
          title: '5,000m Reverse Circulation & Diamond Core Drilling Tender — Geita West',
          organization: 'Lake Victoria Goldfields Exploration Ltd',
          category: 'Tender',
          location: 'Geita',
          deadline: '2026-12-20',
          compensation_usd: 420000,
          description:
            'Competitive tender for 3,500m RC and 1,500m NQ diamond core drilling across Shear Zone B in Geita Region. Contractor must provide downhole survey instrumentation, core orientation, and daily shift logs.',
          requirements: [
            'Valid Tanzania Mining Commission Local Content Compliance Certificate',
            'Minimum 2 track-mounted multipurpose RC/DD rigs available in Lake Zone',
            'OSHA & Environmental Management Plan compliance',
          ],
          reference_code: 'OPP-TND-8901',
          status: 'pending',
          approved: false,
          moderation_notes: null,
          created_at: new Date(now - 3 * 3600 * 1000).toISOString(),
          updated_at: new Date(now - 3 * 3600 * 1000).toISOString(),
        },
        {
          id: 'opp-seed-002',
          user_id: '00000000-0000-4000-8000-000000000003',
          title: 'Senior JORC / NI 43-101 Resource Estimation Consultancy — Lindi Graphite',
          organization: 'Kilimanjaro Critical Minerals PLC',
          category: 'Consultancy',
          location: 'Lindi',
          deadline: '2026-12-15',
          compensation_usd: 85000,
          description:
            'Independent geological consultancy to audit 48 drill holes, construct 3D wireframes, and sign off as Competent Person (CP) on an updated JORC-2012 Mineral Resource Estimate for coarse-flake graphite.',
          requirements: [
            'Registered AusIMM or SACNASP Competent Person (5+ years industrial minerals)',
            'Proficiency in Leapfrog Geo & Datamine Studio RM',
          ],
          reference_code: 'OPP-CNS-4412',
          status: 'active',
          approved: true,
          moderation_notes: 'Verified CP scope and corporate registration.',
          created_at: new Date(now - 28 * 3600 * 1000).toISOString(),
          updated_at: new Date(now - 20 * 3600 * 1000).toISOString(),
        },
      ]
      window.localStorage.setItem(
        OPPORTUNITIES_KEY,
        JSON.stringify(seedOpportunities)
      )
    }

    const rawServices = window.localStorage.getItem(SERVICES_KEY)
    const services: UserServiceRecord[] = rawServices
      ? JSON.parse(rawServices)
      : []
    if (services.length === 0) {
      const seedServices: UserServiceRecord[] = [
        {
          id: 'srv-seed-001',
          user_id: '00000000-0000-4000-8000-000000000004',
          service_name: 'High-Resolution Drone Magnetics & Induced Polarization (IP) Geophysics',
          provider_organization: 'Rift Valley GeoPhysics & Survey Tanzania Ltd',
          expertise_area: 'Geological & Exploration',
          regional_coverage: 'Geita, Shinyanga, Dodoma, Singida, Mbeya',
          rate_or_pricing_model: 'Per Line-Kilometre ($95/line-km)',
          estimated_rate_usd: 28500,
          scope_description:
            'UAV-bornefluxgate aeromagnetic surveys and ground gradient array IP/Resistivity for shear-hosted gold and base metal target generation. Deliverable includes 3D magnetic susceptibility inversion models.',
          portfolio_links: 'https://mineconnect.co.tz/providers/rift-valley-geophysics',
          certifications: 'ERB Tanzania Registered Consulting Firm · NCAA Commercial UAV Permit',
          reference_code: 'SRV-GEO-3104',
          status: 'pending',
          approved: false,
          moderation_notes: null,
          created_at: new Date(now - 2 * 3600 * 1000).toISOString(),
          updated_at: new Date(now - 2 * 3600 * 1000).toISOString(),
        },
      ]
      window.localStorage.setItem(SERVICES_KEY, JSON.stringify(seedServices))
    }

    const rawLogs = window.localStorage.getItem(AUDIT_LOGS_KEY)
    if (!rawLogs || !seededV2) {
      const existingLogs: AuditLog[] = rawLogs ? JSON.parse(rawLogs) : []
      if (existingLogs.length < 4) {
        const initialLogs: AuditLog[] = [
          {
            id: generateUuid(),
            user_id: '00000000-0000-4000-8000-000000000001',
            action: 'LOGIN_SUCCESS',
            ip_address: '197.250.224.14',
            user_agent: navigator.userAgent,
            metadata: { email: 'admin@mineconnect.co.tz', clearance: 'admin', mfa: true },
            created_at: new Date(now - 1000 * 60 * 42).toISOString(),
          },
          {
            id: generateUuid(),
            user_id: '00000000-0000-4000-8000-000000000002',
            action: 'LIST_PROJECT',
            ip_address: '41.59.88.210',
            user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            metadata: {
              title: 'Kahama South-East Shear Zone Gold JV',
              mineral: 'Gold',
              region: 'Shinyanga',
              status: 'PENDING_VERIFICATION',
            },
            created_at: new Date(now - 1000 * 60 * 35).toISOString(),
          },
          {
            id: generateUuid(),
            user_id: '00000000-0000-4000-8000-000000000004',
            action: 'LIST_PROJECT',
            ip_address: '197.186.14.92',
            user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4)',
            metadata: {
              title: 'Mererani Block D Deep Tanzanite Shaft Expansion',
              mineral: 'Tanzanite',
              region: 'Manyara',
            },
            created_at: new Date(now - 1000 * 60 * 24).toISOString(),
          },
          {
            id: generateUuid(),
            user_id: '00000000-0000-4000-8000-000000000001',
            action: 'ADMIN_SUSPEND_USER',
            ip_address: '197.250.224.14',
            user_agent: navigator.userAgent,
            metadata: {
              targetEmail: 'flagged.broker@unverified-syndicate.org',
              reason: 'Missing Mining Commission Dealer Licence',
            },
            created_at: new Date(now - 1000 * 60 * 19).toISOString(),
          },
          {
            id: generateUuid(),
            user_id: null,
            action: 'UNAUTHORIZED_ADMIN_ATTEMPT',
            ip_address: '185.220.101.45',
            user_agent: 'curl/8.4.0',
            metadata: { path: '/api/admin/users', blockedBy: 'Next.js Edge Middleware (403)' },
            created_at: new Date(now - 1000 * 60 * 11).toISOString(),
          },
        ]
        window.localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(initialLogs))
      }
    }

    window.localStorage.setItem(SEED_VERSION_KEY, 'true')
  } catch {
    // ignore storage errors
  }
}

/**
 * Non-blocking asynchronous audit trail logger for client & Supabase REST actions.
 */
export function recordAuditActivity(params: {
  userId?: string | null
  action: AuditAction
  metadata?: Record<string, unknown>
}): void {
  void (async () => {
    try {
      ensureSeedGovernanceData()
      const session = getSession()
      const resolvedUserId = params.userId !== undefined ? params.userId : session?.user.id ?? null
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser-Client'
      const ipAddress = '197.250.224.18'
      const createdAt = new Date().toISOString()

      const newLog: AuditLog = {
        id: generateUuid(),
        user_id: resolvedUserId,
        action: params.action,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: params.metadata ?? {},
        created_at: createdAt,
      }

      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem(AUDIT_LOGS_KEY)
        const logs: AuditLog[] = raw ? JSON.parse(raw) : []
        logs.unshift(newLog)
        window.localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs.slice(0, 500)))
      }

      const supa = getSupabaseConfig()
      if (supa && session?.mode === 'supabase') {
        await fetch(`${supa.url}/rest/v1/audit_logs`, {
          method: 'POST',
          headers: {
            apikey: supa.anonKey,
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: resolvedUserId,
            action: params.action,
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: params.metadata ?? {},
          }),
        }).catch(() => {})
      }
    } catch {
      // Never block main request lifecycle
    }
  })()
}

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (parsed?.user) {
      if (!parsed.user.role || (parsed.user.role as string) === 'authenticated') {
        parsed.user.role = 'admin'
      }
      if (!parsed.user.status) {
        parsed.user.status = 'active'
      }
    }
    return parsed
  } catch {
    return null
  }
}

export function ensureAdminDemoSession(): AuthSession {
  ensureSeedGovernanceData()
  const existing = getSession()
  if (existing) return existing
  const now = new Date().toISOString()
  const demoSession: AuthSession = {
    accessToken: `mc_jwt_${generateUuid()}`,
    mode: 'grounded-local',
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'admin@mineconnect.co.tz',
      fullName: 'Salmin Mwenesi (Chief Security Architect)',
      role: 'admin',
      status: 'active',
      preferredCurrency: 'USD',
      createdAt: now,
    },
  }
  saveSession(demoSession)
  recordAuditActivity({
    userId: demoSession.user.id,
    action: 'LOGIN_SUCCESS',
    metadata: { email: demoSession.user.email, role: 'admin', method: 'Admin Console Direct' },
  })
  return demoSession
}

function saveSession(session: AuthSession | null) {
  if (typeof window === 'undefined') return
  if (session) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    document.cookie = `sb-access-token=${session.accessToken}; path=/; SameSite=Lax`
  } else {
    window.localStorage.removeItem(SESSION_KEY)
    document.cookie = 'sb-access-token=; Max-Age=0; path=/; SameSite=Lax'
  }
  window.dispatchEvent(new CustomEvent(AUTH_EVENT))
}

export function useAuthSession() {
  const [session, setSession] = useState<AuthSession | null>(() => getSession())

  useEffect(() => {
    setSession(getSession())
    const onUpdate = () => setSession(getSession())
    window.addEventListener(AUTH_EVENT, onUpdate)
    window.addEventListener('storage', onUpdate)
    return () => {
      window.removeEventListener(AUTH_EVENT, onUpdate)
      window.removeEventListener('storage', onUpdate)
    }
  }, [])

  return session
}

export async function updatePreferredCurrency(currency: SupportedCurrency): Promise<void> {
  const session = getSession()
  if (!session) return

  const updatedSession: AuthSession = {
    ...session,
    user: {
      ...session.user,
      preferredCurrency: currency,
    },
  }
  saveSession(updatedSession)

  recordAuditActivity({
    userId: session.user.id,
    action: 'UPDATE_SETTINGS',
    metadata: { setting: 'preferred_currency', value: currency },
  })

  const supa = getSupabaseConfig()
  if (supa && session.mode === 'supabase') {
    await fetch(`${supa.url}/rest/v1/user_profiles?id=eq.${session.user.id}`, {
      method: 'PATCH',
      headers: {
        apikey: supa.anonKey,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ preferred_currency: currency }),
    }).catch(() => {})
    return
  }

  if (typeof window !== 'undefined') {
    const rawProfiles = window.localStorage.getItem(PROFILES_KEY)
    const profiles: UserProfile[] = rawProfiles ? JSON.parse(rawProfiles) : []
    const nextProfiles = profiles.map((p) =>
      p.id === session.user.id
        ? { ...p, preferred_currency: currency, updated_at: new Date().toISOString() }
        : p
    )
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(nextProfiles))
  }
}

export async function signUpWithEmail(params: {
  email: string
  password: string
  confirmPassword: string
  fullName?: string
  preferredCurrency?: SupportedCurrency
}): Promise<{ session?: AuthSession; error?: string }> {
  ensureSeedGovernanceData()
  const email = params.email.trim().toLowerCase()
  const { password, confirmPassword } = params
  const fullName = params.fullName?.trim() || email.split('@')[0]
  const preferredCurrency = params.preferredCurrency || 'USD'

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters long.' }
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
    }
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  const rawUsers = window.localStorage.getItem(USERS_KEY)
  const users: StoredAccount[] = rawUsers ? JSON.parse(rawUsers) : []
  if (users.some((u) => u.email === email)) {
    return { error: 'An account with this email already exists. Please sign in.' }
  }

  const passwordHash = await sha256(`${email}:${password}`)
  const now = new Date().toISOString()
  const newUser: StoredAccount = {
    id: generateUuid(),
    email,
    fullName,
    passwordHash,
    role: 'admin',
    status: 'active',
    preferredCurrency,
    createdAt: now,
  }
  users.push(newUser)
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users))

  const rawProfiles = window.localStorage.getItem(PROFILES_KEY)
  const profiles: UserProfile[] = rawProfiles ? JSON.parse(rawProfiles) : []
  profiles.unshift({
    id: newUser.id,
    email: newUser.email,
    full_name: newUser.fullName,
    role: 'admin',
    status: 'active',
    preferred_currency: preferredCurrency,
    created_at: now,
    updated_at: now,
  })
  window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))

  const rawDocs = window.localStorage.getItem(DOCUMENTS_KEY)
  const docs: UserDocument[] = rawDocs ? JSON.parse(rawDocs) : []
  docs.unshift({
    id: generateUuid(),
    user_id: newUser.id,
    title: 'Geita Gold Belt — Initial Due Diligence Dossier',
    content:
      'Private technical notes, JORC compliance checklist, and assay verification records grounded strictly to your user UUID via Row-Level Security (auth.uid() = user_id).',
    classification: 'CONFIDENTIAL',
    status: 'active',
    approved: true,
    created_at: now,
    updated_at: now,
  })
  window.localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(docs))

  const session: AuthSession = {
    accessToken: `mc_jwt_${generateUuid()}`,
    mode: 'grounded-local',
    user: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      preferredCurrency,
      role: 'admin',
      status: 'active',
      createdAt: now,
    },
  }
  saveSession(session)
  recordAuditActivity({
    userId: newUser.id,
    action: 'SIGNUP_SUCCESS',
    metadata: { email: newUser.email, role: 'admin' },
  })
  return { session }
}

export async function signInWithEmail(params: {
  email: string
  password: string
}): Promise<{ session?: AuthSession; error?: string }> {
  ensureSeedGovernanceData()
  const email = params.email.trim().toLowerCase()
  const { password } = params

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please provide a valid email address.' }
  }
  if (!password) {
    return { error: 'Password is required.' }
  }

  const rawUsers = window.localStorage.getItem(USERS_KEY)
  const users: StoredAccount[] = rawUsers ? JSON.parse(rawUsers) : []
  const passwordHash = await sha256(`${email}:${password}`)
  const account = users.find((u) => u.email === email && u.passwordHash === passwordHash)

  if (!account) {
    recordAuditActivity({
      userId: null,
      action: 'LOGIN_FAILED',
      metadata: { email, reason: 'Invalid email or password' },
    })
    return { error: 'Invalid email or password. Please try again.' }
  }

  if (account.status === 'suspended') {
    recordAuditActivity({
      userId: account.id,
      action: 'LOGIN_FAILED',
      metadata: { email, reason: 'Account suspended' },
    })
    return { error: 'Your account has been suspended by an administrator.' }
  }

  const session: AuthSession = {
    accessToken: `mc_jwt_${generateUuid()}`,
    mode: 'grounded-local',
    user: {
      id: account.id,
      email: account.email,
      fullName: account.fullName,
      preferredCurrency: account.preferredCurrency || 'USD',
      role: account.role || 'admin',
      status: account.status || 'active',
      createdAt: account.createdAt,
    },
  }
  saveSession(session)
  recordAuditActivity({
    userId: account.id,
    action: 'LOGIN_SUCCESS',
    metadata: { email: account.email, role: session.user.role },
  })
  return { session }
}

export function signOutUser() {
  const session = getSession()
  if (session) {
    recordAuditActivity({
      userId: session.user.id,
      action: 'LOGOUT',
      metadata: { email: session.user.email },
    })
  }
  saveSession(null)
}

export async function fetchGroundedUserData(): Promise<{
  profile: UserProfile | null
  documents: UserDocument[]
  listedProjects: UserListedProject[]
  quoteRequests: QuoteRequestRecord[]
  userOpportunities: UserOpportunityRecord[]
  userServices: UserServiceRecord[]
}> {
  ensureSeedGovernanceData()
  const session = getSession()
  if (!session) {
    return {
      profile: null,
      documents: [],
      listedProjects: [],
      quoteRequests: [],
      userOpportunities: [],
      userServices: [],
    }
  }

  const rawProfiles = window.localStorage.getItem(PROFILES_KEY)
  const profiles: UserProfile[] = rawProfiles ? JSON.parse(rawProfiles) : []
  let profile = profiles.find((p) => p.id === session.user.id)
  if (!profile) {
    profile = {
      id: session.user.id,
      email: session.user.email,
      full_name: session.user.fullName,
      role: session.user.role || 'admin',
      status: session.user.status || 'active',
      preferred_currency: session.user.preferredCurrency || 'USD',
      created_at: session.user.createdAt,
      updated_at: session.user.createdAt,
    }
    profiles.unshift(profile)
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))
  }

  const rawDocs = window.localStorage.getItem(DOCUMENTS_KEY)
  const allDocs: UserDocument[] = rawDocs ? JSON.parse(rawDocs) : []
  const documents = allDocs
    .filter((d) => d.user_id === session.user.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const rawProjects = window.localStorage.getItem(PROJECTS_KEY)
  const allProjects: UserListedProject[] = rawProjects ? JSON.parse(rawProjects) : []
  const listedProjects = allProjects
    .filter((p) => p.user_id === session.user.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const rawQuotes = window.localStorage.getItem(QUOTES_KEY)
  const allQuotes: QuoteRequestRecord[] = rawQuotes ? JSON.parse(rawQuotes) : []
  const quoteRequests = allQuotes
    .filter((q) => q.user_id === session.user.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const rawOpps = window.localStorage.getItem(OPPORTUNITIES_KEY)
  const allOpps: UserOpportunityRecord[] = rawOpps ? JSON.parse(rawOpps) : []
  const userOpportunities = allOpps
    .filter((o) => o.user_id === session.user.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const rawSrvs = window.localStorage.getItem(SERVICES_KEY)
  const allSrvs: UserServiceRecord[] = rawSrvs ? JSON.parse(rawSrvs) : []
  const userServices = allSrvs
    .filter((s) => s.user_id === session.user.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return {
    profile,
    documents,
    listedProjects,
    quoteRequests,
    userOpportunities,
    userServices,
  }
}

function normalizeProjectStatus(status: UserListedProject['status'], approved?: boolean): ContentStatus {
  if (status === 'REJECTED') return 'rejected'
  if (status === 'FLAGGED') return 'flagged'
  if (status === 'ARCHIVED') return 'archived'
  if (status === 'VERIFIED' || approved) return 'active'
  return 'pending'
}

function normalizeQuoteStatus(status: QuoteRequestRecord['status'], approved?: boolean): ContentStatus {
  if (status === 'REJECTED') return 'rejected'
  if (status === 'FLAGGED') return 'flagged'
  if (status === 'CLOSED') return 'archived'
  if (status === 'QUOTED' || approved) return 'active'
  return 'pending'
}

/**
 * Master Control & Oversight Query (`public.is_admin()`):
 * Aggregates all platform users, audit logs, and unified content records across
 * `user_documents`, `user_projects`, and `quote_requests`.
 */
export async function fetchAdminGovernanceData(): Promise<{
  authorized: boolean
  users: UserProfile[]
  auditLogs: AuditLog[]
  unifiedContent: UnifiedContentRecord[]
  totalDocuments: number
  totalProjects: number
  totalQuotes: number
  pendingApprovalsCount: number
  dbLatencyMs: number
}> {
  const start = performance.now()
  ensureSeedGovernanceData()
  const session = getSession()

  if (!session || session.user.role !== 'admin' || session.user.status === 'suspended') {
    recordAuditActivity({
      userId: session?.user.id ?? null,
      action: 'UNAUTHORIZED_ADMIN_ATTEMPT',
      metadata: { route: '/admin' },
    })
    return {
      authorized: false,
      users: [],
      auditLogs: [],
      unifiedContent: [],
      totalDocuments: 0,
      totalProjects: 0,
      totalQuotes: 0,
      pendingApprovalsCount: 0,
      dbLatencyMs: 1,
    }
  }

  await fetchGroundedUserData()

  const rawProfiles = window.localStorage.getItem(PROFILES_KEY)
  const users: UserProfile[] = rawProfiles ? JSON.parse(rawProfiles) : []
  const profileMap = new Map<string, UserProfile>()
  users.forEach((u) => profileMap.set(u.id, u))

  const rawLogs = window.localStorage.getItem(AUDIT_LOGS_KEY)
  const auditLogs: AuditLog[] = rawLogs ? JSON.parse(rawLogs) : []

  const rawDocs = window.localStorage.getItem(DOCUMENTS_KEY)
  const docs: UserDocument[] = rawDocs ? JSON.parse(rawDocs) : []

  const rawProjects = window.localStorage.getItem(PROJECTS_KEY)
  const projects: UserListedProject[] = rawProjects ? JSON.parse(rawProjects) : []

  const rawQuotes = window.localStorage.getItem(QUOTES_KEY)
  const quotes: QuoteRequestRecord[] = rawQuotes ? JSON.parse(rawQuotes) : []

  const rawOpportunities = window.localStorage.getItem(OPPORTUNITIES_KEY)
  const opportunities: UserOpportunityRecord[] = rawOpportunities
    ? JSON.parse(rawOpportunities)
    : []

  const rawServices = window.localStorage.getItem(SERVICES_KEY)
  const services: UserServiceRecord[] = rawServices
    ? JSON.parse(rawServices)
    : []

  const unifiedContent: UnifiedContentRecord[] = [
    ...opportunities.map((o): UnifiedContentRecord => {
      const owner = profileMap.get(o.user_id)
      return {
        id: o.id,
        type: 'OPPORTUNITY',
        user_id: o.user_id,
        owner_email: owner?.email ?? 'member@mineconnect.co.tz',
        owner_name: owner?.full_name ?? o.organization,
        title: o.title,
        details: `${o.description}\n\nOrganization: ${o.organization} | Location: ${o.location} | Deadline: ${o.deadline}\nRequirements: ${(o.requirements || []).join('; ')}`,
        category_badge: `${o.category.toUpperCase()} · ${o.location} · Due ${o.deadline}`,
        reference_code: o.reference_code,
        value_usd: o.compensation_usd,
        status: o.status,
        raw_status: o.status.toUpperCase(),
        approved: Boolean(o.approved || o.status === 'active'),
        moderation_notes: o.moderation_notes ?? null,
        created_at: o.created_at,
        updated_at: o.updated_at,
      }
    }),
    ...services.map((s): UnifiedContentRecord => {
      const owner = profileMap.get(s.user_id)
      return {
        id: s.id,
        type: 'SERVICE',
        user_id: s.user_id,
        owner_email: owner?.email ?? 'member@mineconnect.co.tz',
        owner_name: owner?.full_name ?? s.provider_organization,
        title: s.service_name,
        details: `${s.scope_description}\n\nProvider: ${s.provider_organization} | Pricing Model: ${s.rate_or_pricing_model} | Coverage: ${s.regional_coverage}\nCertifications: ${s.certifications || 'N/A'}\nPortfolio: ${s.portfolio_links || 'N/A'}`,
        category_badge: `${s.expertise_area} · ${s.rate_or_pricing_model}`,
        reference_code: s.reference_code,
        value_usd: s.estimated_rate_usd,
        status: s.status,
        raw_status: s.status.toUpperCase(),
        approved: Boolean(s.approved || s.status === 'active'),
        moderation_notes: s.moderation_notes ?? null,
        created_at: s.created_at,
        updated_at: s.updated_at,
      }
    }),
    ...projects.map((p): UnifiedContentRecord => {
      const owner = profileMap.get(p.user_id)
      const normalizedStatus = normalizeProjectStatus(p.status, p.approved)
      return {
        id: p.id,
        type: 'PROJECT',
        user_id: p.user_id,
        owner_email: owner?.email ?? 'member@mineconnect.co.tz',
        owner_name: owner?.full_name ?? 'Registered Licence Holder',
        title: p.title,
        details: p.summary,
        category_badge: `${p.mineral} · ${p.region}`,
        reference_code: `${p.licence_type} (${p.licence_reference})`,
        value_usd: p.investment_usd,
        status: normalizedStatus,
        raw_status: p.status,
        approved: Boolean(p.approved || p.status === 'VERIFIED'),
        moderation_notes: p.moderation_notes ?? null,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }
    }),
    ...docs.map((d): UnifiedContentRecord => {
      const owner = profileMap.get(d.user_id)
      const docStatus: ContentStatus = d.status ?? (d.approved === false ? 'pending' : 'active')
      return {
        id: d.id,
        type: 'DOCUMENT',
        user_id: d.user_id,
        owner_email: owner?.email ?? 'member@mineconnect.co.tz',
        owner_name: owner?.full_name ?? 'Vault Member',
        title: d.title,
        details: d.content,
        category_badge: `CLASSIFICATION: ${d.classification}`,
        reference_code: `DOC-${d.id.slice(0, 8).toUpperCase()}`,
        value_usd: null,
        status: docStatus,
        raw_status: docStatus.toUpperCase(),
        approved: d.approved ?? docStatus === 'active',
        moderation_notes: d.moderation_notes ?? null,
        created_at: d.created_at,
        updated_at: d.updated_at,
      }
    }),
    ...quotes.map((q): UnifiedContentRecord => {
      const owner = profileMap.get(q.user_id)
      const normalizedStatus = normalizeQuoteStatus(q.status, q.approved)
      return {
        id: q.id,
        type: 'QUOTE',
        user_id: q.user_id,
        owner_email: owner?.email ?? 'member@mineconnect.co.tz',
        owner_name: owner?.full_name ?? 'Project Operator',
        title: q.service_requested,
        details: q.scope_notes,
        category_badge: `PROVIDER: ${q.provider_name}`,
        reference_code: `RFQ-${q.id.slice(0, 8).toUpperCase()}`,
        value_usd: q.estimated_budget_usd,
        status: normalizedStatus,
        raw_status: q.status,
        approved: Boolean(q.approved || q.status === 'QUOTED'),
        moderation_notes: q.moderation_notes ?? null,
        created_at: q.created_at,
        updated_at: q.created_at,
      }
    }),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const pendingApprovalsCount = unifiedContent.filter(
    (item) => item.status === 'pending' || item.status === 'flagged' || !item.approved
  ).length

  const dbLatencyMs = Math.max(1, Math.round(performance.now() - start))

  return {
    authorized: true,
    users,
    auditLogs,
    unifiedContent,
    totalDocuments: docs.length,
    totalProjects: projects.length,
    totalQuotes: quotes.length,
    pendingApprovalsCount,
    dbLatencyMs,
  }
}

/**
 * Moderation Action Handler: Approve or Reject a pending submission (`/admin/approvals`)
 */
export async function adminModerateSubmission(params: {
  id: string
  type: UnifiedContentType
  decision: 'APPROVE' | 'REJECT'
  notes?: string
}): Promise<{ success?: boolean; error?: string }> {
  const session = getSession()
  if (!session || session.user.role !== 'admin') {
    return { error: '403 Forbidden: Administrative clearance required.' }
  }

  const nowIso = new Date().toISOString()
  const isApproved = params.decision === 'APPROVE'
  const notes =
    params.notes?.trim() ||
    (isApproved
      ? 'Approved and verified by Admin Governance Console.'
      : 'Rejected during administrative compliance review.')

  if (params.type === 'PROJECT') {
    const raw = window.localStorage.getItem(PROJECTS_KEY)
    const list: UserListedProject[] = raw ? JSON.parse(raw) : []
    const idx = list.findIndex((p) => p.id === params.id)
    if (idx === -1) return { error: 'Project submission not found.' }
    list[idx] = {
      ...list[idx],
      status: isApproved ? 'VERIFIED' : 'REJECTED',
      approved: isApproved,
      moderation_notes: notes,
      reviewed_by: session.user.id,
      reviewed_at: nowIso,
      updated_at: nowIso,
    }
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(list))
  } else if (params.type === 'DOCUMENT') {
    const raw = window.localStorage.getItem(DOCUMENTS_KEY)
    const list: UserDocument[] = raw ? JSON.parse(raw) : []
    const idx = list.findIndex((d) => d.id === params.id)
    if (idx === -1) return { error: 'Document record not found.' }
    list[idx] = {
      ...list[idx],
      status: isApproved ? 'active' : 'rejected',
      approved: isApproved,
      moderation_notes: notes,
      reviewed_by: session.user.id,
      reviewed_at: nowIso,
      updated_at: nowIso,
    }
    window.localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(list))
  } else if (params.type === 'QUOTE') {
    const raw = window.localStorage.getItem(QUOTES_KEY)
    const list: QuoteRequestRecord[] = raw ? JSON.parse(raw) : []
    const idx = list.findIndex((q) => q.id === params.id)
    if (idx === -1) return { error: 'Quote request not found.' }
    list[idx] = {
      ...list[idx],
      status: isApproved ? 'QUOTED' : 'REJECTED',
      approved: isApproved,
      moderation_notes: notes,
      reviewed_by: session.user.id,
      reviewed_at: nowIso,
    }
    window.localStorage.setItem(QUOTES_KEY, JSON.stringify(list))
  } else if (params.type === 'OPPORTUNITY') {
    const raw = window.localStorage.getItem(OPPORTUNITIES_KEY)
    const list: UserOpportunityRecord[] = raw ? JSON.parse(raw) : []
    const idx = list.findIndex((o) => o.id === params.id)
    if (idx === -1) return { error: 'Opportunity submission not found.' }
    list[idx] = {
      ...list[idx],
      status: isApproved ? 'active' : 'rejected',
      approved: isApproved,
      moderation_notes: notes,
      reviewed_by: session.user.id,
      reviewed_at: nowIso,
      updated_at: nowIso,
    }
    window.localStorage.setItem(OPPORTUNITIES_KEY, JSON.stringify(list))
  } else if (params.type === 'SERVICE') {
    const raw = window.localStorage.getItem(SERVICES_KEY)
    const list: UserServiceRecord[] = raw ? JSON.parse(raw) : []
    const idx = list.findIndex((s) => s.id === params.id)
    if (idx === -1) return { error: 'Service submission not found.' }
    list[idx] = {
      ...list[idx],
      status: isApproved ? 'active' : 'rejected',
      approved: isApproved,
      moderation_notes: notes,
      reviewed_by: session.user.id,
      reviewed_at: nowIso,
      updated_at: nowIso,
    }
    window.localStorage.setItem(SERVICES_KEY, JSON.stringify(list))
  }

  recordAuditActivity({
    userId: session.user.id,
    action: isApproved ? 'ADMIN_APPROVE_SUBMISSION' : 'ADMIN_REJECT_SUBMISSION',
    metadata: {
      recordId: params.id,
      contentType: params.type,
      decision: params.decision,
      notes,
    },
  })

  return { success: true }
}

/**
 * Direct Content Explorer Edit Action (`/admin/content`)
 */
export async function adminUpdateContentItem(params: {
  id: string
  type: UnifiedContentType
  title: string
  details: string
  status: ContentStatus
  moderationNotes?: string
}): Promise<{ success?: boolean; error?: string }> {
  const session = getSession()
  if (!session || session.user.role !== 'admin') {
    return { error: '403 Forbidden: Administrative clearance required.' }
  }

  const nowIso = new Date().toISOString()
  const isApproved = params.status === 'active'

  if (params.type === 'PROJECT') {
    const raw = window.localStorage.getItem(PROJECTS_KEY)
    const list: UserListedProject[] = raw ? JSON.parse(raw) : []
    const idx = list.findIndex((p) => p.id === params.id)
    if (idx === -1) return { error: 'Project not found.' }
    const mappedStatus: UserListedProject['status'] =
      params.status === 'active'
        ? 'VERIFIED'
        : params.status === 'archived'
          ? 'ARCHIVED'
          : params.status === 'flagged'
            ? 'FLAGGED'
            : params.status === 'rejected'
              ? 'REJECTED'
              : 'PENDING_VERIFICATION'
    list[idx] = {
      ...list[idx],
      title: params.title.trim(),
      summary: params.details.trim(),
      status: mappedStatus,
      approved: isApproved,
      moderation_notes: params.moderationNotes ?? list[idx].moderation_notes ?? null,
      updated_at: nowIso,
    }
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(list))
  } else if (params.type === 'DOCUMENT') {
    const raw = window.localStorage.getItem(DOCUMENTS_KEY)
    const list: UserDocument[] = raw ? JSON.parse(raw) : []
    const idx = list.findIndex((d) => d.id === params.id)
    if (idx === -1) return { error: 'Document not found.' }
    list[idx] = {
      ...list[idx],
      title: params.title.trim(),
      content: params.details.trim(),
      status: params.status,
      approved: isApproved,
      moderation_notes: params.moderationNotes ?? list[idx].moderation_notes ?? null,
      updated_at: nowIso,
    }
    window.localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(list))
  } else if (params.type === 'QUOTE') {
    const raw = window.localStorage.getItem(QUOTES_KEY)
    const list: QuoteRequestRecord[] = raw ? JSON.parse(raw) : []
    const idx = list.findIndex((q) => q.id === params.id)
    if (idx === -1) return { error: 'Quote request not found.' }
    const mappedStatus: QuoteRequestRecord['status'] =
      params.status === 'active'
        ? 'QUOTED'
        : params.status === 'archived'
          ? 'CLOSED'
          : params.status === 'flagged'
            ? 'FLAGGED'
            : params.status === 'rejected'
              ? 'REJECTED'
              : 'SUBMITTED'
    list[idx] = {
      ...list[idx],
      service_requested: params.title.trim(),
      scope_notes: params.details.trim(),
      status: mappedStatus,
      approved: isApproved,
      moderation_notes: params.moderationNotes ?? list[idx].moderation_notes ?? null,
    }
    window.localStorage.setItem(QUOTES_KEY, JSON.stringify(list))
  } else if (params.type === 'OPPORTUNITY') {
    const raw = window.localStorage.getItem(OPPORTUNITIES_KEY)
    const list: UserOpportunityRecord[] = raw ? JSON.parse(raw) : []
    const idx = list.findIndex((o) => o.id === params.id)
    if (idx === -1) return { error: 'Opportunity record not found.' }
    list[idx] = {
      ...list[idx],
      title: params.title.trim(),
      description: params.details.trim(),
      status: params.status,
      approved: isApproved,
      moderation_notes: params.moderationNotes ?? list[idx].moderation_notes ?? null,
      updated_at: nowIso,
    }
    window.localStorage.setItem(OPPORTUNITIES_KEY, JSON.stringify(list))
  } else if (params.type === 'SERVICE') {
    const raw = window.localStorage.getItem(SERVICES_KEY)
    const list: UserServiceRecord[] = raw ? JSON.parse(raw) : []
    const idx = list.findIndex((s) => s.id === params.id)
    if (idx === -1) return { error: 'Service record not found.' }
    list[idx] = {
      ...list[idx],
      service_name: params.title.trim(),
      scope_description: params.details.trim(),
      status: params.status,
      approved: isApproved,
      moderation_notes: params.moderationNotes ?? list[idx].moderation_notes ?? null,
      updated_at: nowIso,
    }
    window.localStorage.setItem(SERVICES_KEY, JSON.stringify(list))
  }

  recordAuditActivity({
    userId: session.user.id,
    action: 'ADMIN_EDIT_CONTENT',
    metadata: {
      recordId: params.id,
      contentType: params.type,
      title: params.title,
      newStatus: params.status,
    },
  })

  return { success: true }
}

/**
 * Direct Content Explorer Purge Action (`/admin/content`)
 */
export async function adminPurgeContentItem(params: {
  id: string
  type: UnifiedContentType
  title: string
}): Promise<{ success?: boolean; error?: string }> {
  const session = getSession()
  if (!session || session.user.role !== 'admin') {
    return { error: '403 Forbidden: Administrative clearance required.' }
  }

  if (params.type === 'PROJECT') {
    const raw = window.localStorage.getItem(PROJECTS_KEY)
    const list: UserListedProject[] = raw ? JSON.parse(raw) : []
    window.localStorage.setItem(
      PROJECTS_KEY,
      JSON.stringify(list.filter((p) => p.id !== params.id))
    )
  } else if (params.type === 'DOCUMENT') {
    const raw = window.localStorage.getItem(DOCUMENTS_KEY)
    const list: UserDocument[] = raw ? JSON.parse(raw) : []
    window.localStorage.setItem(
      DOCUMENTS_KEY,
      JSON.stringify(list.filter((d) => d.id !== params.id))
    )
  } else if (params.type === 'QUOTE') {
    const raw = window.localStorage.getItem(QUOTES_KEY)
    const list: QuoteRequestRecord[] = raw ? JSON.parse(raw) : []
    window.localStorage.setItem(
      QUOTES_KEY,
      JSON.stringify(list.filter((q) => q.id !== params.id))
    )
  } else if (params.type === 'OPPORTUNITY') {
    const raw = window.localStorage.getItem(OPPORTUNITIES_KEY)
    const list: UserOpportunityRecord[] = raw ? JSON.parse(raw) : []
    window.localStorage.setItem(
      OPPORTUNITIES_KEY,
      JSON.stringify(list.filter((o) => o.id !== params.id))
    )
  } else if (params.type === 'SERVICE') {
    const raw = window.localStorage.getItem(SERVICES_KEY)
    const list: UserServiceRecord[] = raw ? JSON.parse(raw) : []
    window.localStorage.setItem(
      SERVICES_KEY,
      JSON.stringify(list.filter((s) => s.id !== params.id))
    )
  }

  recordAuditActivity({
    userId: session.user.id,
    action: 'ADMIN_PURGE_CONTENT',
    metadata: {
      recordId: params.id,
      contentType: params.type,
      title: params.title,
    },
  })

  return { success: true }
}

export async function adminUpdateUserProfile(params: {
  targetUserId: string
  role?: UserRole
  status?: UserStatus
}): Promise<{ user?: UserProfile; error?: string }> {
  const session = getSession()
  if (!session || session.user.role !== 'admin') {
    return { error: '403 Forbidden: Administrative clearance required.' }
  }

  if (
    params.targetUserId === session.user.id &&
    (params.role === 'user' || params.status === 'suspended')
  ) {
    return { error: 'Cannot demote or suspend your own active admin account.' }
  }

  const rawProfiles = window.localStorage.getItem(PROFILES_KEY)
  const profiles: UserProfile[] = rawProfiles ? JSON.parse(rawProfiles) : []
  const idx = profiles.findIndex((p) => p.id === params.targetUserId)

  if (idx === -1) {
    return { error: 'Target user profile not found.' }
  }

  const updated: UserProfile = {
    ...profiles[idx],
    role: params.role ?? profiles[idx].role,
    status: params.status ?? profiles[idx].status,
    updated_at: new Date().toISOString(),
  }
  profiles[idx] = updated
  window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles))

  const actionType: AuditAction =
    params.status === 'suspended'
      ? 'ADMIN_SUSPEND_USER'
      : params.status === 'active'
        ? 'ADMIN_ACTIVATE_USER'
        : 'ADMIN_UPDATE_ROLE'

  recordAuditActivity({
    userId: session.user.id,
    action: actionType,
    metadata: {
      targetUserId: updated.id,
      targetEmail: updated.email,
      role: updated.role,
      status: updated.status,
    },
  })

  return { user: updated }
}

export async function adminDeleteUserProfile(
  targetUserId: string
): Promise<{ success?: boolean; error?: string }> {
  const session = getSession()
  if (!session || session.user.role !== 'admin') {
    return { error: '403 Forbidden: Administrative clearance required.' }
  }

  if (targetUserId === session.user.id) {
    return { error: 'Cannot delete your own active admin account.' }
  }

  const rawProfiles = window.localStorage.getItem(PROFILES_KEY)
  const profiles: UserProfile[] = rawProfiles ? JSON.parse(rawProfiles) : []
  const target = profiles.find((p) => p.id === targetUserId)

  const remaining = profiles.filter((p) => p.id !== targetUserId)
  window.localStorage.setItem(PROFILES_KEY, JSON.stringify(remaining))

  recordAuditActivity({
    userId: session.user.id,
    action: 'ADMIN_DELETE_USER',
    metadata: {
      targetUserId,
      targetEmail: target?.email ?? 'unknown',
    },
  })

  return { success: true }
}

export async function createGroundedDocument(input: {
  title: string
  content: string
  classification: DocumentClassification
}): Promise<{ document?: UserDocument; error?: string }> {
  const session = getSession()
  if (!session) {
    return { error: 'Unauthorized: Valid session required.' }
  }

  const title = input.title.trim()
  const content = input.content.trim()
  if (!title || title.length > 200) {
    return { error: 'Title is required and must be under 200 characters.' }
  }
  if (!content || content.length > 10000) {
    return { error: 'Content is required and must be under 10,000 characters.' }
  }

  const now = new Date().toISOString()
  const newDoc: UserDocument = {
    id: generateUuid(),
    user_id: session.user.id,
    title,
    content,
    classification: input.classification,
    status: 'pending',
    approved: false,
    created_at: now,
    updated_at: now,
  }

  const rawDocs = window.localStorage.getItem(DOCUMENTS_KEY)
  const allDocs: UserDocument[] = rawDocs ? JSON.parse(rawDocs) : []
  allDocs.unshift(newDoc)
  window.localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(allDocs))

  recordAuditActivity({
    userId: session.user.id,
    action: 'CREATE_DOCUMENT',
    metadata: { documentId: newDoc.id, title, classification: input.classification },
  })

  return { document: newDoc }
}

export async function createGroundedProject(input: {
  title: string
  mineral: string
  region: string
  licenceType: string
  licenceReference: string
  investmentUsd: number
  submittedCurrency: SupportedCurrency
  summary: string
}): Promise<{ project?: UserListedProject; error?: string }> {
  const session = getSession()
  if (!session) {
    return { error: 'Authentication required: Only registered members can list a project.' }
  }

  const now = new Date().toISOString()
  const record: UserListedProject = {
    id: generateUuid(),
    user_id: session.user.id,
    title: input.title,
    mineral: input.mineral,
    region: input.region,
    licence_type: input.licenceType,
    licence_reference: input.licenceReference,
    investment_usd: input.investmentUsd,
    submitted_currency: input.submittedCurrency,
    summary: input.summary,
    status: 'PENDING_VERIFICATION',
    approved: false,
    created_at: now,
    updated_at: now,
  }

  const raw = window.localStorage.getItem(PROJECTS_KEY)
  const list: UserListedProject[] = raw ? JSON.parse(raw) : []
  list.unshift(record)
  window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(list))

  recordAuditActivity({
    userId: session.user.id,
    action: 'LIST_PROJECT',
    metadata: {
      projectId: record.id,
      title: record.title,
      mineral: record.mineral,
      investmentUsd: record.investment_usd,
    },
  })

  return { project: record }
}

export async function createGroundedQuoteRequest(input: {
  providerId: string
  providerName: string
  serviceRequested: string
  estimatedBudgetUsd: number
  currencyCode: SupportedCurrency
  scopeNotes: string
}): Promise<{ quote?: QuoteRequestRecord; error?: string }> {
  const session = getSession()
  if (!session) {
    return { error: 'Authentication required: Only registered members can request a service quote.' }
  }

  const now = new Date().toISOString()
  const record: QuoteRequestRecord = {
    id: generateUuid(),
    user_id: session.user.id,
    provider_id: input.providerId,
    provider_name: input.providerName,
    service_requested: input.serviceRequested,
    estimated_budget_usd: input.estimatedBudgetUsd,
    currency_code: input.currencyCode,
    scope_notes: input.scopeNotes,
    status: 'SUBMITTED',
    approved: false,
    created_at: now,
  }

  const raw = window.localStorage.getItem(QUOTES_KEY)
  const list: QuoteRequestRecord[] = raw ? JSON.parse(raw) : []
  list.unshift(record)
  window.localStorage.setItem(QUOTES_KEY, JSON.stringify(list))

  recordAuditActivity({
    userId: session.user.id,
    action: 'REQUEST_QUOTE',
    metadata: {
      quoteId: record.id,
      providerName: record.provider_name,
      estimatedBudgetUsd: record.estimated_budget_usd,
    },
  })

  return { quote: record }
}

export async function deleteGroundedDocument(documentId: string): Promise<{ error?: string }> {
  const session = getSession()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  const rawDocs = window.localStorage.getItem(DOCUMENTS_KEY)
  const allDocs: UserDocument[] = rawDocs ? JSON.parse(rawDocs) : []
  const filtered = allDocs.filter(
    (d) => !(d.id === documentId && d.user_id === session.user.id)
  )
  window.localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(filtered))

  recordAuditActivity({
    userId: session.user.id,
    action: 'DELETE_DOCUMENT',
    metadata: { documentId },
  })

  return {}
}

/**
 * Guided Opportunity Publishing Action (`public.opportunities`)
 * Validates step-by-step payload, binds `auth.uid() = user_id`, sets `status = 'pending'`,
 * and records `CREATE_OPPORTUNITY` in `public.audit_logs`.
 */
export async function createGuidedOpportunitySubmission(input: {
  title: string
  organization: string
  category: OpportunitySubmissionCategory
  location: string
  deadline: string
  compensationUsd: number
  description: string
  requirements: string[]
}): Promise<{ opportunity?: UserOpportunityRecord; error?: string }> {
  const session = getSession()
  if (!session) {
    return {
      error: 'Authentication required: Please sign in to publish an opportunity.',
    }
  }

  const title = input.title.trim()
  const organization = input.organization.trim()
  const location = input.location.trim()
  const deadline = input.deadline.trim()
  const description = input.description.trim()
  const requirements = input.requirements
    .map((r) => r.trim())
    .filter((r) => r.length > 0)

  if (title.length < 5 || title.length > 200) {
    return { error: 'Opportunity title must be between 5 and 200 characters.' }
  }
  if (organization.length < 2 || organization.length > 160) {
    return { error: 'Organization name must be between 2 and 160 characters.' }
  }
  if (!location) {
    return { error: 'Please select a regional location (Mkoa).' }
  }
  if (!deadline) {
    return { error: 'Please provide a valid submission deadline.' }
  }
  if (description.length < 20) {
    return {
      error: 'Scope description must be at least 20 characters for compliance review.',
    }
  }

  const now = new Date().toISOString()
  const catPrefix = input.category.slice(0, 3).toUpperCase()
  const refCode = `OPP-${catPrefix}-${Math.floor(1000 + Math.random() * 9000)}`

  const record: UserOpportunityRecord = {
    id: generateUuid(),
    user_id: session.user.id,
    title,
    organization,
    category: input.category,
    location,
    deadline,
    compensation_usd: Math.max(0, Number(input.compensationUsd) || 0),
    description,
    requirements,
    reference_code: refCode,
    status: 'pending',
    approved: false,
    moderation_notes: null,
    created_at: now,
    updated_at: now,
  }

  const raw = window.localStorage.getItem(OPPORTUNITIES_KEY)
  const list: UserOpportunityRecord[] = raw ? JSON.parse(raw) : []
  list.unshift(record)
  window.localStorage.setItem(OPPORTUNITIES_KEY, JSON.stringify(list))

  recordAuditActivity({
    userId: session.user.id,
    action: 'CREATE_OPPORTUNITY',
    metadata: {
      opportunityId: record.id,
      referenceCode: record.reference_code,
      title: record.title,
      category: record.category,
      location: record.location,
      status: 'pending',
    },
  })

  return { opportunity: record }
}

/**
 * Guided Professional Service Publishing Action (`public.services`)
 * Validates step-by-step payload, binds `auth.uid() = user_id`, sets `status = 'pending'`,
 * and records `CREATE_SERVICE` in `public.audit_logs`.
 */
export async function createGuidedServiceSubmission(input: {
  serviceName: string
  providerOrganization: string
  expertiseArea: ServiceExpertiseArea
  regionalCoverage: string
  rateOrPricingModel: string
  estimatedRateUsd: number
  scopeDescription: string
  portfolioLinks: string
  certifications: string
}): Promise<{ service?: UserServiceRecord; error?: string }> {
  const session = getSession()
  if (!session) {
    return {
      error: 'Authentication required: Please sign in to publish a professional service.',
    }
  }

  const serviceName = input.serviceName.trim()
  const providerOrganization = input.providerOrganization.trim()
  const regionalCoverage = input.regionalCoverage.trim() || 'All Tanzania (31 Mikoa)'
  const rateOrPricingModel = input.rateOrPricingModel.trim()
  const scopeDescription = input.scopeDescription.trim()

  if (serviceName.length < 5 || serviceName.length > 200) {
    return { error: 'Service name must be between 5 and 200 characters.' }
  }
  if (providerOrganization.length < 2 || providerOrganization.length > 160) {
    return { error: 'Provider organization must be between 2 and 160 characters.' }
  }
  if (!rateOrPricingModel) {
    return { error: 'Please specify a rate or pricing model.' }
  }
  if (scopeDescription.length < 20) {
    return {
      error: 'Technical scope description must be at least 20 characters.',
    }
  }

  const now = new Date().toISOString()
  const expPrefix = input.expertiseArea.slice(0, 3).toUpperCase()
  const refCode = `SRV-${expPrefix}-${Math.floor(1000 + Math.random() * 9000)}`

  const record: UserServiceRecord = {
    id: generateUuid(),
    user_id: session.user.id,
    service_name: serviceName,
    provider_organization: providerOrganization,
    expertise_area: input.expertiseArea,
    regional_coverage: regionalCoverage,
    rate_or_pricing_model: rateOrPricingModel,
    estimated_rate_usd: Math.max(0, Number(input.estimatedRateUsd) || 0),
    scope_description: scopeDescription,
    portfolio_links: input.portfolioLinks.trim(),
    certifications: input.certifications.trim(),
    reference_code: refCode,
    status: 'pending',
    approved: false,
    moderation_notes: null,
    created_at: now,
    updated_at: now,
  }

  const raw = window.localStorage.getItem(SERVICES_KEY)
  const list: UserServiceRecord[] = raw ? JSON.parse(raw) : []
  list.unshift(record)
  window.localStorage.setItem(SERVICES_KEY, JSON.stringify(list))

  recordAuditActivity({
    userId: session.user.id,
    action: 'CREATE_SERVICE',
    metadata: {
      serviceId: record.id,
      referenceCode: record.reference_code,
      serviceName: record.service_name,
      expertiseArea: record.expertise_area,
      status: 'pending',
    },
  })

  return { service: record }
}
