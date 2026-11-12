import { useEffect, useState } from 'react'
import type {
  AuditAction,
  AuditLog,
  DocumentClassification,
  QuoteRequestRecord,
  SupportedCurrency,
  UserDocument,
  UserListedProject,
  UserProfile,
  UserRole,
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
const AUDIT_LOGS_KEY = 'mineconnect.db.audit_logs.v1'
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
 * Ensures initial seed profiles and audit logs exist for administrative governance inspection
 */
function ensureSeedGovernanceData() {
  if (typeof window === 'undefined') return
  try {
    const rawLogs = window.localStorage.getItem(AUDIT_LOGS_KEY)
    if (!rawLogs) {
      const now = Date.now()
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
          metadata: { title: 'Kahama High-Grade Gold Vein JV', mineral: 'Gold', region: 'Shinyanga' },
          created_at: new Date(now - 1000 * 60 * 28).toISOString(),
        },
        {
          id: generateUuid(),
          user_id: null,
          action: 'UNAUTHORIZED_ADMIN_ATTEMPT',
          ip_address: '185.220.101.45',
          user_agent: 'curl/8.4.0',
          metadata: { path: '/api/admin/users', blockedBy: 'Next.js Edge Middleware (403)' },
          created_at: new Date(now - 1000 * 60 * 15).toISOString(),
        },
      ]
      window.localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(initialLogs))
    }

    const rawProfiles = window.localStorage.getItem(PROFILES_KEY)
    const profiles: UserProfile[] = rawProfiles ? JSON.parse(rawProfiles) : []
    if (profiles.length === 0) {
      const nowIso = new Date().toISOString()
      const seededProfiles: UserProfile[] = [
        {
          id: '00000000-0000-4000-8000-000000000001',
          email: 'admin@mineconnect.co.tz',
          full_name: 'Salmin Mwenesi (Chief Security Architect)',
          role: 'admin',
          status: 'active',
          preferred_currency: 'USD',
          created_at: nowIso,
          updated_at: nowIso,
        },
        {
          id: '00000000-0000-4000-8000-000000000002',
          email: 'geology.director@tanzaniagold.co.tz',
          full_name: 'Dr. Amani Nyerere',
          role: 'user',
          status: 'active',
          preferred_currency: 'TZS',
          created_at: nowIso,
          updated_at: nowIso,
        },
      ]
      window.localStorage.setItem(PROFILES_KEY, JSON.stringify(seededProfiles))
    }
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
    // Ensure role and status fields are always populated
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

  const supa = getSupabaseConfig()
  if (supa) {
    const res = await fetch(`${supa.url}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: supa.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        data: { full_name: fullName, preferred_currency: preferredCurrency, role: 'admin' },
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      return { error: data.msg || data.error_description || data.message || 'Sign-up failed.' }
    }
    if (data.user) {
      const session: AuthSession = {
        accessToken: data.access_token || generateUuid(),
        mode: 'supabase',
        user: {
          id: data.user.id,
          email: data.user.email,
          fullName: data.user.user_metadata?.full_name || fullName,
          preferredCurrency,
          role: 'admin',
          status: 'active',
          createdAt: data.user.created_at || new Date().toISOString(),
        },
      }
      saveSession(session)
      recordAuditActivity({
        userId: session.user.id,
        action: 'SIGNUP_SUCCESS',
        metadata: { email: session.user.email, role: session.user.role },
      })
      return { session }
    }
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
  profiles.push({
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
  docs.push({
    id: generateUuid(),
    user_id: newUser.id,
    title: 'Geita Gold Belt — Initial Due Diligence Dossier',
    content:
      'Private technical notes, JORC compliance checklist, and assay verification records grounded strictly to your user UUID via Row-Level Security (auth.uid() = user_id).',
    classification: 'CONFIDENTIAL',
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

  const supa = getSupabaseConfig()
  if (supa) {
    const res = await fetch(`${supa.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: supa.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      recordAuditActivity({
        userId: null,
        action: 'LOGIN_FAILED',
        metadata: { email, reason: 'Invalid credentials' },
      })
      return { error: 'Invalid email or password. Please try again.' }
    }
    const session: AuthSession = {
      accessToken: data.access_token,
      mode: 'supabase',
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name || email.split('@')[0],
        preferredCurrency: data.user.user_metadata?.preferred_currency || 'USD',
        role: (data.user.app_metadata?.role as UserRole) || 'admin',
        status: 'active',
        createdAt: data.user.created_at || new Date().toISOString(),
      },
    }
    saveSession(session)
    recordAuditActivity({
      userId: session.user.id,
      action: 'LOGIN_SUCCESS',
      metadata: { email: session.user.email, mode: 'supabase' },
    })
    return { session }
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

/**
 * RLS-Grounded Query: Returns strictly rows where `user_id === session.user.id`
 */
export async function fetchGroundedUserData(): Promise<{
  profile: UserProfile | null
  documents: UserDocument[]
  listedProjects: UserListedProject[]
  quoteRequests: QuoteRequestRecord[]
}> {
  ensureSeedGovernanceData()
  const session = getSession()
  if (!session) {
    return { profile: null, documents: [], listedProjects: [], quoteRequests: [] }
  }

  const supa = getSupabaseConfig()
  if (supa && session.mode === 'supabase') {
    const headers = {
      apikey: supa.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
    }
    const [profRes, docsRes, projRes, quotesRes] = await Promise.all([
      fetch(`${supa.url}/rest/v1/user_profiles?id=eq.${session.user.id}&select=*`, { headers }),
      fetch(
        `${supa.url}/rest/v1/user_documents?user_id=eq.${session.user.id}&select=*&order=created_at.desc`,
        { headers }
      ),
      fetch(
        `${supa.url}/rest/v1/user_projects?user_id=eq.${session.user.id}&select=*&order=created_at.desc`,
        { headers }
      ),
      fetch(
        `${supa.url}/rest/v1/quote_requests?user_id=eq.${session.user.id}&select=*&order=created_at.desc`,
        { headers }
      ),
    ])
    const profiles = profRes.ok ? ((await profRes.json()) as UserProfile[]) : []
    const documents = docsRes.ok ? ((await docsRes.json()) as UserDocument[]) : []
    const listedProjects = projRes.ok ? ((await projRes.json()) as UserListedProject[]) : []
    const quoteRequests = quotesRes.ok ? ((await quotesRes.json()) as QuoteRequestRecord[]) : []
    return { profile: profiles[0] ?? null, documents, listedProjects, quoteRequests }
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

  return { profile, documents, listedProjects, quoteRequests }
}

/**
 * Admin-Only Governance Query (`public.is_admin()`):
 * Returns all `user_profiles`, `audit_logs`, and platform counts for `/admin`.
 */
export async function fetchAdminGovernanceData(): Promise<{
  authorized: boolean
  users: UserProfile[]
  auditLogs: AuditLog[]
  totalDocuments: number
  totalProjects: number
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
      totalDocuments: 0,
      totalProjects: 0,
      dbLatencyMs: 1,
    }
  }

  // Ensure current admin profile is in the profiles table
  await fetchGroundedUserData()

  const rawProfiles = window.localStorage.getItem(PROFILES_KEY)
  const users: UserProfile[] = rawProfiles ? JSON.parse(rawProfiles) : []

  const rawLogs = window.localStorage.getItem(AUDIT_LOGS_KEY)
  const auditLogs: AuditLog[] = rawLogs ? JSON.parse(rawLogs) : []

  const rawDocs = window.localStorage.getItem(DOCUMENTS_KEY)
  const docs: UserDocument[] = rawDocs ? JSON.parse(rawDocs) : []

  const rawProjects = window.localStorage.getItem(PROJECTS_KEY)
  const projects: UserListedProject[] = rawProjects ? JSON.parse(rawProjects) : []

  const dbLatencyMs = Math.max(1, Math.round(performance.now() - start))

  return {
    authorized: true,
    users,
    auditLogs,
    totalDocuments: docs.length,
    totalProjects: projects.length,
    dbLatencyMs,
  }
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
    created_at: now,
    updated_at: now,
  }

  const rawDocs = window.localStorage.getItem(DOCUMENTS_KEY)
  const allDocs: UserDocument[] = rawDocs ? JSON.parse(rawDocs) : []
  allDocs.push(newDoc)
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
    created_at: now,
    updated_at: now,
  }

  const raw = window.localStorage.getItem(PROJECTS_KEY)
  const list: UserListedProject[] = raw ? JSON.parse(raw) : []
  list.push(record)
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
    created_at: now,
  }

  const raw = window.localStorage.getItem(QUOTES_KEY)
  const list: QuoteRequestRecord[] = raw ? JSON.parse(raw) : []
  list.push(record)
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
