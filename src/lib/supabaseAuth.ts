import { useEffect, useState } from 'react'
import type { Session as SupabaseSdkSession } from '@supabase/supabase-js'
import {
  getSupabaseClient,
  isSupabaseConfigured,
  requireSupabaseClient,
} from './supabaseClient'
import {
  OpportunitySubmissionSchema,
  ServiceSubmissionSchema,
  sanitizeString,
} from './securityValidators'
import { validateStrongPassword } from './validations/auth'
import {
  normalizeVerificationLevel,
  VERIFICATION_LEVELS,
} from './verificationLevels'
import {
  VERIFICATION_STORAGE_BUCKET,
  type PreparedVerificationFile,
} from './verificationUpload'
import type {
  AdminAuditLogRecord,
  AuditAction,
  AuditLog,
  ComplianceComplaintCategory,
  ComplianceComplaintRecord,
  ComplianceComplaintStatus,
  ContentStatus,
  DocumentClassification,
  Json,
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
  UserVerificationStatus,
  VerificationDocumentMetadata,
  VerificationLevelCode,
  VerificationSubmissionDocumentPreview,
  VerificationSubmissionPreview,
  VerificationSubmissionSummary,
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
  mode: 'supabase'
}

export interface AuthState {
  session: AuthSession | null
  profile: UserProfile | null
  isAdmin: boolean
  passwordRecovery: boolean
  loading: boolean
  authLoading: boolean
  profileLoading: boolean
  profileError: string | null
  configured: boolean
}

const AUTH_EVENT = 'mineconnect:auth-changed'
const PRIMARY_OWNER_EMAIL = 'salminmwenesi@gmail.com'

let currentSession: AuthSession | null = null
let currentProfile: UserProfile | null = null
let currentProfileError: string | null = null
let passwordRecoveryActive = false
let authLoading = true
let profileLoading = false
let authBootstrapped = false
let authInitPromise: Promise<AuthSession | null> | null = null

function hasRecoveryIndicatorInUrl(): boolean {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash || ''
  const search = new URLSearchParams(window.location.search)
  return (
    hash.includes('type=recovery') ||
    search.get('type') === 'recovery'
  )
}

export function isPasswordRecoveryActive(): boolean {
  return passwordRecoveryActive
}

export function clearPasswordRecoveryState(): void {
  passwordRecoveryActive = false
  notifyAuthListeners()
}

export function evaluateIsAdmin(
  profile: Partial<UserProfile> | null | undefined,
  email?: string | null
): boolean {
  const normalizedStatus = String(profile?.status ?? 'active')
    .trim()
    .toLowerCase()
  if (normalizedStatus === 'suspended') {
    return false
  }

  const normalizedRole = String(profile?.role ?? '')
    .trim()
    .toLowerCase()
  if (normalizedRole === 'admin') {
    return true
  }

  // Resilient safeguard for primary platform owner while profile is still hydrating
  // or if a transient RLS/network error prevents reading the profile row.
  const normalizedEmail = String(email ?? profile?.email ?? '')
    .trim()
    .toLowerCase()
  if (
    normalizedEmail === PRIMARY_OWNER_EMAIL &&
    (!profile || normalizedRole === '' || normalizedRole === 'admin')
  ) {
    return true
  }

  return false
}

function notifyAuthListeners() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EVENT))
  }
}

function setCurrentSession(
  next: AuthSession | null,
  profile: UserProfile | null = next ? currentProfile : null
) {
  currentSession = next
  currentProfile = profile
  notifyAuthListeners()
}

type ProfileTableName = 'profiles' | 'user_profiles' | 'users'
type ProjectTableName = 'projects' | 'user_projects'
type QuoteTableName = 'quotes' | 'quote_requests'

let resolvedProfileTable: ProfileTableName | null = null
let resolvedProjectTable: ProjectTableName | null = null
let resolvedQuoteTable: QuoteTableName | null = null

function isMissingRelationError(
  error: { code?: string; message?: string } | null
): boolean {
  if (!error) return false
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /relation .* does not exist|could not find the table/i.test(
      error.message || ''
    )
  )
}

async function resolveProfileTable(): Promise<ProfileTableName> {
  if (resolvedProfileTable) return resolvedProfileTable
  const supabase = getSupabaseClient()
  if (!supabase) return 'profiles'

  const { error: profilesErr } = await supabase
    .from('profiles')
    .select('id', { head: true, count: 'exact' })
    .limit(1)
  if (!isMissingRelationError(profilesErr)) {
    resolvedProfileTable = 'profiles'
    return 'profiles'
  }

  const { error: userProfilesErr } = await supabase
    .from('user_profiles')
    .select('id', { head: true, count: 'exact' })
    .limit(1)
  if (!isMissingRelationError(userProfilesErr)) {
    resolvedProfileTable = 'user_profiles'
    return 'user_profiles'
  }

  resolvedProfileTable = 'users'
  return 'users'
}

async function resolveProjectTable(): Promise<ProjectTableName> {
  if (resolvedProjectTable) return resolvedProjectTable
  const supabase = getSupabaseClient()
  if (!supabase) return 'projects'

  const { error: projectsErr } = await supabase
    .from('projects')
    .select('id', { head: true, count: 'exact' })
    .limit(1)
  if (!isMissingRelationError(projectsErr)) {
    resolvedProjectTable = 'projects'
    return 'projects'
  }

  resolvedProjectTable = 'user_projects'
  return 'user_projects'
}

async function resolveQuoteTable(): Promise<QuoteTableName> {
  if (resolvedQuoteTable) return resolvedQuoteTable
  const supabase = getSupabaseClient()
  if (!supabase) return 'quotes'

  const { error: quotesErr } = await supabase
    .from('quotes')
    .select('id', { head: true, count: 'exact' })
    .limit(1)
  if (!isMissingRelationError(quotesErr)) {
    resolvedQuoteTable = 'quotes'
    return 'quotes'
  }

  resolvedQuoteTable = 'quote_requests'
  return 'quote_requests'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeProfileRow(raw: Record<string, unknown>, fallbackId: string): UserProfile {
  const rawRole = String(raw.role ?? 'user').trim().toLowerCase()
  const rawStatus = String(raw.status ?? 'active').trim().toLowerCase()
  const rawVerif = String(raw.verification_status ?? 'unverified').trim().toLowerCase()
  const verificationStatus: UserVerificationStatus =
    rawVerif === 'verified' || rawVerif === 'pending' || rawVerif === 'rejected'
      ? rawVerif
      : 'unverified'
  const verificationLevel = normalizeVerificationLevel(
    raw.verification_level as string | number | null | undefined,
    verificationStatus,
  )
  const nowIso = new Date().toISOString()

  return {
    id: typeof raw.id === 'string' ? raw.id : fallbackId,
    email: typeof raw.email === 'string' ? raw.email : '',
    full_name: typeof raw.full_name === 'string' ? raw.full_name : null,
    company_name: typeof raw.company_name === 'string' ? raw.company_name : null,
    phone: typeof raw.phone === 'string' ? raw.phone : null,
    role: rawRole === 'admin' ? 'admin' : 'user',
    status: rawStatus === 'suspended' ? 'suspended' : 'active',
    verification_status: verificationStatus,
    verification_level: verificationLevel,
    verification_notes:
      typeof raw.verification_notes === 'string' ? raw.verification_notes : null,
    verified_at: typeof raw.verified_at === 'string' ? raw.verified_at : null,
    verified_by: typeof raw.verified_by === 'string' ? raw.verified_by : null,
    preferred_currency:
      (typeof raw.preferred_currency === 'string'
        ? (raw.preferred_currency as SupportedCurrency)
        : 'USD'),
    created_at: typeof raw.created_at === 'string' ? raw.created_at : nowIso,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : nowIso,
  }
}

/**
 * Fetches the authoritative profile row from `public.profiles` (falling back to
 * `public.user_profiles` only if missing). Uses `select('*')` so optional columns
 * never cause 42703 failures, logs any Supabase RLS/network errors to console.error,
 * and retries briefly for PostgreSQL `AFTER INSERT` trigger timing.
 */
async function fetchProfileRecord(
  userId: string,
  retries = 3
): Promise<UserProfile | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  currentProfileError = null

  for (let attempt = 0; attempt < retries; attempt++) {
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (profileErr) {
      console.error('[MineConnect Auth] Failed to fetch public.profiles row:', {
        code: profileErr.code,
        message: profileErr.message,
        details: profileErr.details,
        hint: profileErr.hint,
        userId,
        attempt: attempt + 1,
      })
      currentProfileError = `${profileErr.code ?? 'DB_ERROR'}: ${profileErr.message}`
    } else if (profileData) {
      resolvedProfileTable = 'profiles'
      currentProfileError = null
      return normalizeProfileRow(
        profileData as unknown as Record<string, unknown>,
        userId
      )
    }

    // Only fallback to legacy `user_profiles` if `profiles` is missing or had no matching row
    if (!profileData) {
      const { data: legacyData, error: legacyErr } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (legacyErr && !isMissingRelationError(legacyErr)) {
        console.error('[MineConnect Auth] Failed to fetch public.user_profiles fallback:', {
          code: legacyErr.code,
          message: legacyErr.message,
          userId,
        })
      } else if (legacyData) {
        if (isMissingRelationError(profileErr)) {
          resolvedProfileTable = 'user_profiles'
        }
        currentProfileError = null
        return normalizeProfileRow(
          legacyData as unknown as Record<string, unknown>,
          userId
        )
      }
    }

    if (attempt < retries - 1) {
      await sleep(150 * (attempt + 1))
    }
  }

  return null
}

async function hydrateFromSupabaseSession(
  sdkSession: SupabaseSdkSession | null,
  options?: { silent?: boolean }
): Promise<AuthSession | null> {
  if (!sdkSession?.user) {
    profileLoading = false
    currentProfileError = null
    setCurrentSession(null, null)
    return null
  }

  const silent = Boolean(
    options?.silent &&
      currentSession?.user.id === sdkSession.user.id &&
      currentProfile?.id === sdkSession.user.id
  )

  if (!silent) {
    profileLoading = true
    notifyAuthListeners()
  }

  try {
    const profile = await fetchProfileRecord(sdkSession.user.id)

    // Block suspended accounts immediately at session hydration
    if (String(profile?.status ?? 'active').trim().toLowerCase() === 'suspended') {
      const supabase = getSupabaseClient()
      if (supabase) {
        await supabase.auth.signOut()
      }
      setCurrentSession(null, null)
      return null
    }

    const meta = (sdkSession.user.user_metadata ?? {}) as Record<string, unknown>
    const email = profile?.email || sdkSession.user.email || ''
    const fullName =
      profile?.full_name ||
      (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
      email.split('@')[0] ||
      'Member'

    const isAdmin = evaluateIsAdmin(profile, email)
    const role: UserRole = isAdmin ? 'admin' : 'user'
    const status: UserStatus = 'active'
    const preferredCurrency =
      (profile?.preferred_currency as SupportedCurrency | undefined) || 'USD'

    const hydrated: AuthSession = {
      accessToken: sdkSession.access_token,
      mode: 'supabase',
      user: {
        id: sdkSession.user.id,
        email,
        fullName,
        role,
        status,
        preferredCurrency,
        createdAt: profile?.created_at || sdkSession.user.created_at,
      },
    }

    setCurrentSession(hydrated, profile)
    return hydrated
  } finally {
    if (profileLoading) {
      profileLoading = false
      notifyAuthListeners()
    }
  }
}

function bootstrapSupabaseAuth(): Promise<AuthSession | null> {
  if (typeof window === 'undefined') {
    authLoading = false
    profileLoading = false
    return Promise.resolve(null)
  }

  if (authInitPromise) {
    return authInitPromise
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    authBootstrapped = true
    authLoading = false
    profileLoading = false
    setCurrentSession(null, null)
    return Promise.resolve(null)
  }

  if (!authBootstrapped) {
    authBootstrapped = true
    if (hasRecoveryIndicatorInUrl()) {
      passwordRecoveryActive = true
    }
    // CRITICAL: Defer Supabase DB queries outside onAuthStateChange callback with setTimeout(0)
    // to avoid @supabase/supabase-js v2 GoTrue internal auth lock deadlocks.
    supabase.auth.onAuthStateChange((event, nextSdkSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        passwordRecoveryActive = true
        notifyAuthListeners()
      }

      if (event === 'SIGNED_OUT' || !nextSdkSession?.user) {
        authLoading = false
        profileLoading = false
        currentProfileError = null
        passwordRecoveryActive = false
        setCurrentSession(null, null)
        return
      }

      const sameActiveUser =
        currentSession?.user.id === nextSdkSession.user.id &&
        currentProfile?.id === nextSdkSession.user.id

      // Silent token refresh for the already-hydrated user: keep UI mounted & preserve active tabs/selections
      if (event === 'TOKEN_REFRESHED' && sameActiveUser && currentSession) {
        if (currentSession.accessToken !== nextSdkSession.access_token) {
          currentSession = {
            ...currentSession,
            accessToken: nextSdkSession.access_token,
          }
        }
        return
      }

      if (!sameActiveUser) {
        profileLoading = true
        notifyAuthListeners()
      }

      window.setTimeout(() => {
        void hydrateFromSupabaseSession(nextSdkSession, {
          silent: sameActiveUser,
        }).finally(() => {
          const hadLoadingFlags = authLoading || profileLoading
          authLoading = false
          profileLoading = false
          if (hadLoadingFlags) {
            notifyAuthListeners()
          }
        })
      }, 0)
    })
  }

  authInitPromise = supabase.auth
    .getSession()
    .then(async ({ data, error }) => {
      if (error) {
        console.error('[MineConnect Auth] supabase.auth.getSession() failed:', error)
      }
      return await hydrateFromSupabaseSession(data.session)
    })
    .catch((err) => {
      console.error('[MineConnect Auth] Unexpected session bootstrap error:', err)
      setCurrentSession(null, null)
      return null
    })
    .finally(() => {
      authLoading = false
      profileLoading = false
      notifyAuthListeners()
    })

  return authInitPromise
}

if (typeof window !== 'undefined') {
  void bootstrapSupabaseAuth()
}

export function getSession(): AuthSession | null {
  return currentSession
}

export function getAuthLoading(): boolean {
  return authLoading || profileLoading
}

export async function waitForAuthReady(): Promise<AuthSession | null> {
  await bootstrapSupabaseAuth()
  return currentSession
}

export function useAuthState(): AuthState {
  const buildState = (): AuthState => ({
    session: currentSession,
    profile: currentProfile,
    isAdmin: Boolean(
      currentSession &&
        (currentSession.user.role === 'admin' ||
          evaluateIsAdmin(currentProfile, currentSession.user.email))
    ),
    passwordRecovery: passwordRecoveryActive,
    loading: authLoading || profileLoading,
    authLoading,
    profileLoading,
    profileError: currentProfileError,
    configured: isSupabaseConfigured(),
  })

  const [state, setState] = useState<AuthState>(buildState)

  useEffect(() => {
    void bootstrapSupabaseAuth()
    const sync = () => {
      setState(buildState())
    }
    sync()
    window.addEventListener(AUTH_EVENT, sync)
    return () => {
      window.removeEventListener(AUTH_EVENT, sync)
    }
  }, [])

  return state
}

export function useAuthSession(): AuthSession | null {
  return useAuthState().session
}

/**
 * Non-blocking audit trail writer to `public.audit_logs` via Supabase RLS.
 */
export function recordAuditActivity(params: {
  userId?: string | null
  action: AuditAction
  metadata?: Record<string, unknown>
}): void {
  void (async () => {
    try {
      const supabase = getSupabaseClient()
      if (!supabase) return

      const resolvedUserId =
        params.userId !== undefined ? params.userId : currentSession?.user.id ?? null

      if (!resolvedUserId) return

      const userAgent =
        typeof navigator !== 'undefined' ? navigator.userAgent : 'Browser-Client'

      await supabase.from('audit_logs').insert({
        user_id: resolvedUserId,
        action: params.action,
        ip_address: null,
        user_agent: userAgent,
        metadata: (params.metadata ?? {}) as Json,
      })
    } catch {
      // Never block user flows if telemetry logging fails
    }
  })()
}

export async function updatePreferredCurrency(
  currency: SupportedCurrency
): Promise<void> {
  const session = await waitForAuthReady()
  if (!session) return

  const supabase = getSupabaseClient()
  if (!supabase) return

  const profileTable = await resolveProfileTable()
  const { error } = await supabase
    .from(profileTable)
    .update({ preferred_currency: currency })
    .eq('id', session.user.id)

  if (!error) {
    setCurrentSession({
      ...session,
      user: {
        ...session.user,
        preferredCurrency: currency,
      },
    })
    recordAuditActivity({
      userId: session.user.id,
      action: 'UPDATE_SETTINGS',
      metadata: { setting: 'preferred_currency', value: currency },
    })
  }
}

export async function signUpWithEmail(params: {
  email: string
  password: string
  confirmPassword: string
  fullName?: string
  preferredCurrency?: SupportedCurrency
  captchaToken?: string
  termsAcceptedAt?: string
}): Promise<{ session?: AuthSession; confirmationRequired?: boolean; error?: string }> {
  const email = params.email.trim().toLowerCase()
  const { password, confirmPassword } = params
  const fullName = params.fullName?.trim() || email.split('@')[0]
  const preferredCurrency = params.preferredCurrency || 'USD'
  const termsAcceptedAt = params.termsAcceptedAt || new Date().toISOString()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.' }
  }
  const passwordError = validateStrongPassword(password)
  if (passwordError) {
    return { error: passwordError }
  }
  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  let supabase
  try {
    supabase = requireSupabaseClient()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Supabase is not configured.' }
  }

  // Strictly omit `role` from signup metadata; PostgreSQL `handle_new_user()` enforces role = 'user'
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      ...(params.captchaToken ? { captchaToken: params.captchaToken } : {}),
      data: {
        full_name: fullName,
        preferred_currency: preferredCurrency,
        terms_accepted_at: termsAcceptedAt,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (!data.session) {
    return {
      confirmationRequired: true,
      error:
        'Account created! Please check your email inbox to confirm your address before signing in.',
    }
  }

  // Persist explicit clickwrap consent timestamp on `public.profiles` (best-effort if column exists)
  try {
    await supabase
      .from('profiles')
      .update({ terms_accepted_at: termsAcceptedAt })
      .eq('id', data.session.user.id)
  } catch {
    // Non-blocking if migration is pending; timestamp is also recorded in user_metadata
  }

  const hydrated = await hydrateFromSupabaseSession(data.session)
  if (!hydrated) {
    return { error: 'Account provisioned, but session hydration failed. Please sign in.' }
  }

  recordAuditActivity({
    userId: hydrated.user.id,
    action: 'SIGNUP_SUCCESS',
    metadata: { email: hydrated.user.email, role: hydrated.user.role },
  })

  return { session: hydrated }
}

export async function signInWithEmail(params: {
  email: string
  password: string
  captchaToken?: string
}): Promise<{ session?: AuthSession; error?: string }> {
  const email = params.email.trim().toLowerCase()
  const { password } = params

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please provide a valid email address.' }
  }
  if (!password) {
    return { error: 'Password is required.' }
  }

  let supabase
  try {
    supabase = requireSupabaseClient()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Supabase is not configured.' }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    ...(params.captchaToken
      ? { options: { captchaToken: params.captchaToken } }
      : {}),
  })

  if (error || !data.session) {
    return { error: error?.message || 'Invalid email or password. Please try again.' }
  }

  const profile = await fetchProfileRecord(data.session.user.id)
  if (profile?.status === 'suspended') {
    await supabase.auth.signOut()
    setCurrentSession(null)
    return { error: 'Your account has been suspended by an administrator.' }
  }

  const hydrated = await hydrateFromSupabaseSession(data.session)
  if (!hydrated) {
    return { error: 'Unable to load your account profile. Please try again.' }
  }

  recordAuditActivity({
    userId: hydrated.user.id,
    action: 'LOGIN_SUCCESS',
    metadata: { email: hydrated.user.email, role: hydrated.user.role },
  })

  return { session: hydrated }
}

export async function signOutUser(): Promise<void> {
  const prev = currentSession
  if (prev) {
    recordAuditActivity({
      userId: prev.user.id,
      action: 'LOGOUT',
      metadata: { email: prev.user.email },
    })
  }
  const supabase = getSupabaseClient()
  if (supabase) {
    await supabase.auth.signOut()
  }
  passwordRecoveryActive = false
  setCurrentSession(null)
}

/**
 * Security-hardened password recovery email request.
 * Always responds neutrally (anti-enumeration) so callers never reveal whether an email exists.
 */
export async function requestPasswordResetEmail(
  rawEmail: string,
  captchaToken?: string
): Promise<{ ok: boolean; error?: string }> {
  const email = rawEmail.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' }
  }

  let supabase
  try {
    supabase = requireSupabaseClient()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Supabase is not configured.',
    }
  }

  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/reset-password`
      : undefined

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
    ...(captchaToken ? { captchaToken } : {}),
  })

  if (error) {
    // Log internally for operators, but never disclose account existence to the requester
    console.warn('[MineConnect Auth] Password reset request warning:', error.message)
    if (/captcha/i.test(error.message)) {
      return {
        ok: false,
        error: 'Security verification failed or expired. Please complete the challenge again.',
      }
    }
    if (/rate limit|too many requests|for security purposes/i.test(error.message)) {
      return {
        ok: false,
        error: 'Too many reset requests. Please wait a minute before trying again.',
      }
    }
  }

  return { ok: true }
}

function scrubSensitiveUrlTokens(): void {
  if (typeof window === 'undefined') return
  try {
    const cleanUrl = window.location.pathname
    if (window.location.search || window.location.hash) {
      window.history.replaceState({}, document.title, cleanUrl)
    }
  } catch {
    // ignore history errors
  }
}

/**
 * Validates and exchanges Supabase recovery credentials (PKCE `code`, `token_hash`,
 * implicit hash `access_token`, or active `PASSWORD_RECOVERY` auth event).
 * Scrubs sensitive tokens from the browser URL bar immediately after exchange.
 */
export async function verifyRecoverySessionFromUrl(): Promise<{
  valid: boolean
  reason?: string
}> {
  if (typeof window === 'undefined') {
    return { valid: false, reason: 'Client browser context required.' }
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return { valid: false, reason: 'Authentication service is not configured.' }
  }

  const url = new URL(window.location.href)
  const searchParams = url.searchParams
  const hashParams = new URLSearchParams(
    window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
  )

  const urlError =
    searchParams.get('error_description') ||
    hashParams.get('error_description') ||
    searchParams.get('error') ||
    hashParams.get('error')

  if (urlError) {
    scrubSensitiveUrlTokens()
    passwordRecoveryActive = false
    notifyAuthListeners()
    return { valid: false, reason: 'This password reset link is invalid or has expired.' }
  }

  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const queryType = searchParams.get('type')
  const hashType = hashParams.get('type')
  const hashAccessToken = hashParams.get('access_token')
  const hashRefreshToken = hashParams.get('refresh_token')

  // 1. PKCE recovery code exchange (`?code=...`)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    scrubSensitiveUrlTokens()
    if (error || !data.session) {
      passwordRecoveryActive = false
      notifyAuthListeners()
      return { valid: false, reason: 'This password reset link is invalid or has expired.' }
    }
    passwordRecoveryActive = true
    notifyAuthListeners()
    return { valid: true }
  }

  // 2. Email OTP recovery token_hash verification (`?token_hash=...&type=recovery`)
  if (tokenHash && queryType === 'recovery') {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    })
    scrubSensitiveUrlTokens()
    if (error || !data.session) {
      passwordRecoveryActive = false
      notifyAuthListeners()
      return { valid: false, reason: 'This password reset link is invalid or has expired.' }
    }
    passwordRecoveryActive = true
    notifyAuthListeners()
    return { valid: true }
  }

  // 3. Implicit hash recovery tokens (`#access_token=...&refresh_token=...&type=recovery`)
  if (hashAccessToken && hashRefreshToken && hashType === 'recovery') {
    const { data, error } = await supabase.auth.setSession({
      access_token: hashAccessToken,
      refresh_token: hashRefreshToken,
    })
    scrubSensitiveUrlTokens()
    if (error || !data.session) {
      passwordRecoveryActive = false
      notifyAuthListeners()
      return { valid: false, reason: 'This password reset link is invalid or has expired.' }
    }
    passwordRecoveryActive = true
    notifyAuthListeners()
    return { valid: true }
  }

  // 4. Recovery already hydrated via Supabase `PASSWORD_RECOVERY` auth state event
  await waitForAuthReady()
  if (passwordRecoveryActive) {
    const { data } = await supabase.auth.getSession()
    scrubSensitiveUrlTokens()
    if (data.session) {
      return { valid: true }
    }
  }

  scrubSensitiveUrlTokens()
  return { valid: false, reason: 'This password reset link is invalid or has expired.' }
}

/**
 * Updates the user's password during an active Supabase recovery session,
 * scrubs URL tokens, and clears the temporary recovery session cleanly.
 */
export async function completePasswordRecoveryReset(params: {
  newPassword: string
  confirmPassword: string
}): Promise<{ ok: boolean; error?: string }> {
  const pwdError = validateStrongPassword(params.newPassword)
  if (pwdError) {
    return { ok: false, error: pwdError }
  }
  if (params.newPassword !== params.confirmPassword) {
    return { ok: false, error: 'Passwords do not match.' }
  }

  let supabase
  try {
    supabase = requireSupabaseClient()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Supabase is not configured.',
    }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) {
    passwordRecoveryActive = false
    notifyAuthListeners()
    return {
      ok: false,
      error: 'This password reset link is invalid or has expired. Please request a new reset link.',
    }
  }

  const { data, error } = await supabase.auth.updateUser({
    password: params.newPassword,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  if (data.user) {
    recordAuditActivity({
      userId: data.user.id,
      action: 'UPDATE_SETTINGS',
      metadata: { event: 'password_reset_completed' },
    })
  }

  // Session hygiene: clear sensitive URL tokens & sign out temporary recovery session
  scrubSensitiveUrlTokens()
  passwordRecoveryActive = false
  await supabase.auth.signOut()
  setCurrentSession(null, null)

  return { ok: true }
}

/**
 * Authoritative Zero-Trust Admin Verification:
 * Always validates JWT with Supabase Auth server (`getUser()`) AND checks
 * `public.user_profiles` (`role === 'admin' && status === 'active'`).
 */
async function verifyActiveAdmin(): Promise<
  { authorized: true; userId: string } | { authorized: false; error: string }
> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { authorized: false, error: 'Supabase client is not configured.' }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    if (authError) {
      console.error('[MineConnect Admin] supabase.auth.getUser() error:', authError)
    }
    return { authorized: false, error: '403 Forbidden: Authentication required.' }
  }

  const profile = await fetchProfileRecord(user.id)
  const isAdmin = evaluateIsAdmin(profile, user.email)

  if (!isAdmin) {
    recordAuditActivity({
      userId: user.id,
      action: 'UNAUTHORIZED_ADMIN_ATTEMPT',
      metadata: {
        email: user.email,
        resolvedRole: profile?.role ?? 'user',
        resolvedStatus: profile?.status ?? 'unknown',
      },
    })
    return {
      authorized: false,
      error: '403 Forbidden: Administrative clearance required.',
    }
  }

  return { authorized: true, userId: user.id }
}

export async function fetchGroundedUserData(): Promise<{
  profile: UserProfile | null
  documents: UserDocument[]
  listedProjects: UserListedProject[]
  quoteRequests: QuoteRequestRecord[]
  userOpportunities: UserOpportunityRecord[]
  userServices: UserServiceRecord[]
}> {
  const session = await waitForAuthReady()
  const supabase = getSupabaseClient()

  if (!session || !supabase) {
    return {
      profile: null,
      documents: [],
      listedProjects: [],
      quoteRequests: [],
      userOpportunities: [],
      userServices: [],
    }
  }

  const userId = session.user.id
  const [projectTable, quoteTable] = await Promise.all([
    resolveProjectTable(),
    resolveQuoteTable(),
  ])

  const [profile, docsRes, projectsRes, quotesRes, oppsRes, servicesRes] =
    await Promise.all([
      fetchProfileRecord(userId, 1),
      supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from(projectTable)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from(quoteTable)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('opportunities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('services')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ])

  return {
    profile,
    documents: docsRes.data ?? [],
    listedProjects: projectsRes.data ?? [],
    quoteRequests: quotesRes.data ?? [],
    userOpportunities: oppsRes.data ?? [],
    userServices: servicesRes.data ?? [],
  }
}

function normalizeProjectStatus(
  status: UserListedProject['status'],
  approved?: boolean
): ContentStatus {
  if (status === 'REJECTED') return 'rejected'
  if (status === 'FLAGGED') return 'flagged'
  if (status === 'ARCHIVED') return 'archived'
  if (status === 'VERIFIED' || approved) return 'active'
  return 'pending'
}

function normalizeQuoteStatus(
  status: QuoteRequestRecord['status'],
  approved?: boolean
): ContentStatus {
  if (status === 'REJECTED') return 'rejected'
  if (status === 'FLAGGED') return 'flagged'
  if (status === 'CLOSED') return 'archived'
  if (status === 'QUOTED' || approved) return 'active'
  return 'pending'
}

/**
 * Master Control & Oversight Query (`public.is_active_admin()`):
 * Loads all rows across `user_profiles`, `user_projects`, `quote_requests`,
 * `user_documents`, `opportunities`, `services`, and `audit_logs` directly from Supabase.
 */
/**
 * Records an immutable governance/activity event into `public.admin_audit_logs`
 * (and mirrors into `public.audit_logs` for legacy consumers).
 */
export function recordAdminAuditEvent(params: {
  actorId?: string | null
  actorEmail?: string | null
  actionType: string
  targetTable: string
  targetId?: string | null
  targetSummary?: string | null
  metadata?: Record<string, unknown>
}): void {
  void (async () => {
    try {
      const supabase = getSupabaseClient()
      if (!supabase) return

      const actorId =
        params.actorId !== undefined
          ? params.actorId
          : currentSession?.user.id ?? null
      const actorEmail =
        params.actorEmail !== undefined
          ? params.actorEmail
          : currentSession?.user.email ?? null

      if (!actorId) return

      const { error } = await supabase.from('admin_audit_logs').insert({
        actor_id: actorId,
        actor_email: actorEmail,
        action_type: params.actionType,
        target_table: params.targetTable,
        target_id: params.targetId ?? null,
        target_summary: params.targetSummary ?? null,
        metadata: (params.metadata ?? {}) as Json,
      })

      if (error && !isMissingRelationError(error)) {
        console.error('[MineConnect Audit] Failed to insert admin_audit_logs:', error)
      }
    } catch {
      // Never break user flows on audit telemetry failure
    }
  })()

  recordAuditActivity({
    userId: params.actorId,
    action: params.actionType as AuditAction,
    metadata: {
      targetTable: params.targetTable,
      targetId: params.targetId,
      targetSummary: params.targetSummary,
      ...(params.metadata ?? {}),
    },
  })
}

export async function fetchAdminGovernanceData(): Promise<{
  authorized: boolean
  users: UserProfile[]
  verificationSubmissions: VerificationSubmissionSummary[]
  auditLogs: AuditLog[]
  adminAuditLogs: AdminAuditLogRecord[]
  servicesList: UserServiceRecord[]
  opportunitiesList: UserOpportunityRecord[]
  projectsList: UserListedProject[]
  quotesList: QuoteRequestRecord[]
  unifiedContent: UnifiedContentRecord[]
  totalDocuments: number
  totalProjects: number
  totalQuotes: number
  pendingApprovalsCount: number
  dbLatencyMs: number
  dbError?: string | null
}> {
  const start = performance.now()
  const adminCheck = await verifyActiveAdmin()

  if (!adminCheck.authorized) {
    return {
      authorized: false,
      users: [],
      verificationSubmissions: [],
      auditLogs: [],
      adminAuditLogs: [],
      servicesList: [],
      opportunitiesList: [],
      projectsList: [],
      quotesList: [],
      unifiedContent: [],
      totalDocuments: 0,
      totalProjects: 0,
      totalQuotes: 0,
      pendingApprovalsCount: 0,
      dbLatencyMs: Math.max(1, Math.round(performance.now() - start)),
      dbError: adminCheck.error,
    }
  }

  const supabase = requireSupabaseClient()
  const [profileTable, projectTable, quoteTable] = await Promise.all([
    resolveProfileTable(),
    resolveProjectTable(),
    resolveQuoteTable(),
  ])

  // Lightweight summary column projection for verification submissions (full notes
  // and signed storage document previews are lazy-loaded only when an admin expands a row)
  const [
    profilesRes,
    verifSubsRes,
    auditLogsRes,
    adminAuditLogsRes,
    docsRes,
    projectsRes,
    quotesRes,
    oppsRes,
    servicesRes,
  ] = await Promise.all([
    supabase
      .from(profileTable)
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('verification_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(250),
    supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('user_documents')
      .select('id, user_id, title, content, classification, status, approved, moderation_notes, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(150),
    supabase
      .from(projectTable)
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from(quoteTable)
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('opportunities')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('services')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  const queryErrors: string[] = []
  if (profilesRes.error) {
    console.error(`[MineConnect Admin] Error querying public.${profileTable}:`, profilesRes.error)
    queryErrors.push(`${profileTable}: ${profilesRes.error.message}`)
  }
  if (projectsRes.error && !isMissingRelationError(projectsRes.error)) {
    console.error(`[MineConnect Admin] Error querying public.${projectTable}:`, projectsRes.error)
    queryErrors.push(`${projectTable}: ${projectsRes.error.message}`)
  }
  if (quotesRes.error && !isMissingRelationError(quotesRes.error)) {
    console.error(`[MineConnect Admin] Error querying public.${quoteTable}:`, quotesRes.error)
    queryErrors.push(`${quoteTable}: ${quotesRes.error.message}`)
  }
  if (servicesRes.error && !isMissingRelationError(servicesRes.error)) {
    console.error('[MineConnect Admin] Error querying public.services:', servicesRes.error)
    queryErrors.push(`services: ${servicesRes.error.message}`)
  }
  if (oppsRes.error && !isMissingRelationError(oppsRes.error)) {
    console.error('[MineConnect Admin] Error querying public.opportunities:', oppsRes.error)
    queryErrors.push(`opportunities: ${oppsRes.error.message}`)
  }
  if (adminAuditLogsRes.error && !isMissingRelationError(adminAuditLogsRes.error)) {
    console.error('[MineConnect Admin] Error querying public.admin_audit_logs:', adminAuditLogsRes.error)
  }

  const users = (profilesRes.data ?? []).map((row) =>
    normalizeProfileRow(row as unknown as Record<string, unknown>, String(row.id))
  )
  const verificationSubmissions: VerificationSubmissionSummary[] =
    !verifSubsRes.error && Array.isArray(verifSubsRes.data)
      ? (verifSubsRes.data as unknown as VerificationSubmissionSummary[])
      : []
  const auditLogs = auditLogsRes.data ?? []
  const adminAuditLogs: AdminAuditLogRecord[] =
    (adminAuditLogsRes.data && adminAuditLogsRes.data.length > 0)
      ? adminAuditLogsRes.data
      : auditLogs.map((l) => ({
          id: l.id,
          actor_id: l.user_id,
          actor_email: users.find((u) => u.id === l.user_id)?.email ?? null,
          action_type: l.action,
          target_table: 'public.audit_logs',
          target_id: l.id,
          target_summary: l.action,
          metadata: l.metadata,
          created_at: l.created_at,
        }))
  const docs = docsRes.data ?? []
  const projects = projectsRes.data ?? []
  const quotes = quotesRes.data ?? []
  const opportunities = oppsRes.data ?? []
  const services = servicesRes.data ?? []

  const profileMap = new Map<string, UserProfile>()
  users.forEach((u) => profileMap.set(u.id, u))

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
      const docStatus: ContentStatus =
        d.status ?? (d.approved === false ? 'pending' : 'active')
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
  ].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const pendingApprovalsCount = unifiedContent.filter(
    (item) =>
      item.status === 'pending' || item.status === 'flagged' || !item.approved
  ).length

  const dbLatencyMs = Math.max(1, Math.round(performance.now() - start))

  return {
    authorized: true,
    users,
    verificationSubmissions,
    auditLogs,
    adminAuditLogs,
    servicesList: services,
    opportunitiesList: opportunities,
    projectsList: projects,
    quotesList: quotes,
    unifiedContent,
    totalDocuments: docs.length,
    totalProjects: projects.length,
    totalQuotes: quotes.length,
    pendingApprovalsCount,
    dbLatencyMs,
    dbError: queryErrors.length > 0 ? queryErrors.join(' | ') : null,
  }
}

export async function adminModerateSubmission(params: {
  id: string
  type: UnifiedContentType
  decision: 'APPROVE' | 'REJECT'
  notes?: string
}): Promise<{ success?: boolean; error?: string }> {
  const adminCheck = await verifyActiveAdmin()
  if (!adminCheck.authorized) {
    return { error: adminCheck.error }
  }

  const supabase = requireSupabaseClient()
  const nowIso = new Date().toISOString()
  const isApproved = params.decision === 'APPROVE'
  const notes =
    params.notes?.trim() ||
    (isApproved
      ? 'Approved and verified by Admin Governance Console.'
      : 'Rejected during administrative compliance review.')

  let dbError: { message: string } | null = null

  if (params.type === 'PROJECT') {
    const projectTable = await resolveProjectTable()
    const { error } = await supabase
      .from(projectTable)
      .update({
        status: isApproved ? 'VERIFIED' : 'REJECTED',
        approved: isApproved,
        moderation_notes: notes,
        reviewed_by: adminCheck.userId,
        reviewed_at: nowIso,
      })
      .eq('id', params.id)
    dbError = error
  } else if (params.type === 'DOCUMENT') {
    const { error } = await supabase
      .from('user_documents')
      .update({
        status: isApproved ? 'active' : 'rejected',
        approved: isApproved,
        moderation_notes: notes,
        reviewed_by: adminCheck.userId,
        reviewed_at: nowIso,
      })
      .eq('id', params.id)
    dbError = error
  } else if (params.type === 'QUOTE') {
    const quoteTable = await resolveQuoteTable()
    const { error } = await supabase
      .from(quoteTable)
      .update({
        status: isApproved ? 'QUOTED' : 'REJECTED',
        approved: isApproved,
        moderation_notes: notes,
        reviewed_by: adminCheck.userId,
        reviewed_at: nowIso,
      })
      .eq('id', params.id)
    dbError = error
  } else if (params.type === 'OPPORTUNITY') {
    const { error } = await supabase
      .from('opportunities')
      .update({
        status: isApproved ? 'active' : 'rejected',
        approved: isApproved,
        moderation_notes: notes,
        reviewed_by: adminCheck.userId,
        reviewed_at: nowIso,
      })
      .eq('id', params.id)
    dbError = error
  } else if (params.type === 'SERVICE') {
    const { error } = await supabase
      .from('services')
      .update({
        status: isApproved ? 'active' : 'rejected',
        approved: isApproved,
        moderation_notes: notes,
        reviewed_by: adminCheck.userId,
        reviewed_at: nowIso,
      })
      .eq('id', params.id)
    dbError = error
  }

  if (dbError) {
    return { error: dbError.message }
  }

  recordAuditActivity({
    userId: adminCheck.userId,
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

export async function adminUpdateContentItem(params: {
  id: string
  type: UnifiedContentType
  title: string
  details: string
  status: ContentStatus
  moderationNotes?: string
}): Promise<{ success?: boolean; error?: string }> {
  const adminCheck = await verifyActiveAdmin()
  if (!adminCheck.authorized) {
    return { error: adminCheck.error }
  }

  const supabase = requireSupabaseClient()
  const isApproved = params.status === 'active'
  let dbError: { message: string } | null = null

  if (params.type === 'PROJECT') {
    const projectTable = await resolveProjectTable()
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

    const { error } = await supabase
      .from(projectTable)
      .update({
        title: params.title.trim(),
        summary: params.details.trim(),
        status: mappedStatus,
        approved: isApproved,
        ...(params.moderationNotes !== undefined
          ? { moderation_notes: params.moderationNotes }
          : {}),
      })
      .eq('id', params.id)
    dbError = error
  } else if (params.type === 'DOCUMENT') {
    const { error } = await supabase
      .from('user_documents')
      .update({
        title: params.title.trim(),
        content: params.details.trim(),
        status: params.status,
        approved: isApproved,
        ...(params.moderationNotes !== undefined
          ? { moderation_notes: params.moderationNotes }
          : {}),
      })
      .eq('id', params.id)
    dbError = error
  } else if (params.type === 'QUOTE') {
    const quoteTable = await resolveQuoteTable()
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

    const { error } = await supabase
      .from(quoteTable)
      .update({
        service_requested: params.title.trim(),
        scope_notes: params.details.trim(),
        status: mappedStatus,
        approved: isApproved,
        ...(params.moderationNotes !== undefined
          ? { moderation_notes: params.moderationNotes }
          : {}),
      })
      .eq('id', params.id)
    dbError = error
  } else if (params.type === 'OPPORTUNITY') {
    const { error } = await supabase
      .from('opportunities')
      .update({
        title: params.title.trim(),
        description: params.details.trim(),
        status: params.status,
        approved: isApproved,
        ...(params.moderationNotes !== undefined
          ? { moderation_notes: params.moderationNotes }
          : {}),
      })
      .eq('id', params.id)
    dbError = error
  } else if (params.type === 'SERVICE') {
    const { error } = await supabase
      .from('services')
      .update({
        service_name: params.title.trim(),
        scope_description: params.details.trim(),
        status: params.status,
        approved: isApproved,
        ...(params.moderationNotes !== undefined
          ? { moderation_notes: params.moderationNotes }
          : {}),
      })
      .eq('id', params.id)
    dbError = error
  }

  if (dbError) {
    return { error: dbError.message }
  }

  recordAuditActivity({
    userId: adminCheck.userId,
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

export async function adminPurgeContentItem(params: {
  id: string
  type: UnifiedContentType
  title: string
}): Promise<{ success?: boolean; error?: string }> {
  const adminCheck = await verifyActiveAdmin()
  if (!adminCheck.authorized) {
    return { error: adminCheck.error }
  }

  const supabase = requireSupabaseClient()
  const [projectTable, quoteTable] = await Promise.all([
    resolveProjectTable(),
    resolveQuoteTable(),
  ])
  const tableMap = {
    PROJECT: projectTable,
    DOCUMENT: 'user_documents',
    QUOTE: quoteTable,
    OPPORTUNITY: 'opportunities',
    SERVICE: 'services',
  } as const

  const { error } = await supabase
    .from(tableMap[params.type])
    .delete()
    .eq('id', params.id)

  if (error) {
    return { error: error.message }
  }

  recordAuditActivity({
    userId: adminCheck.userId,
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
  const adminCheck = await verifyActiveAdmin()
  if (!adminCheck.authorized) {
    return { error: adminCheck.error }
  }

  if (
    params.targetUserId === adminCheck.userId &&
    (params.role === 'user' || params.status === 'suspended')
  ) {
    return { error: 'Cannot demote or suspend your own active admin account.' }
  }

  const supabase = requireSupabaseClient()
  const profileTable = await resolveProfileTable()
  const patch: { role?: UserRole; status?: UserStatus } = {}
  if (params.role !== undefined) patch.role = params.role
  if (params.status !== undefined) patch.status = params.status

  const { data: updated, error } = await supabase
    .from(profileTable)
    .update(patch)
    .eq('id', params.targetUserId)
    .select('*')
    .single()

  if (error || !updated) {
    return { error: error?.message || 'Target user profile not found.' }
  }

  // Keep secondary profile tables in sync if present
  if (profileTable !== 'user_profiles') {
    await supabase.from('user_profiles').update(patch).eq('id', params.targetUserId)
  }
  if (profileTable !== 'users') {
    await supabase.from('users').update(patch).eq('id', params.targetUserId)
  }

  const actionType: AuditAction =
    params.status === 'suspended'
      ? 'ADMIN_SUSPEND_USER'
      : params.status === 'active'
        ? 'ADMIN_ACTIVATE_USER'
        : 'ADMIN_UPDATE_ROLE'

  recordAuditActivity({
    userId: adminCheck.userId,
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
  const adminCheck = await verifyActiveAdmin()
  if (!adminCheck.authorized) {
    return { error: adminCheck.error }
  }

  if (targetUserId === adminCheck.userId) {
    return { error: 'Cannot delete your own active admin account.' }
  }

  const supabase = requireSupabaseClient()
  const profileTable = await resolveProfileTable()
  const { data: target } = await supabase
    .from(profileTable)
    .select('email')
    .eq('id', targetUserId)
    .maybeSingle()

  const { error } = await supabase
    .from(profileTable)
    .delete()
    .eq('id', targetUserId)

  if (error) {
    return { error: error.message }
  }

  if (profileTable !== 'user_profiles') {
    await supabase.from('user_profiles').delete().eq('id', targetUserId)
  }
  if (profileTable !== 'users') {
    await supabase.from('users').delete().eq('id', targetUserId)
  }

  recordAuditActivity({
    userId: adminCheck.userId,
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
  const session = await waitForAuthReady()
  if (!session) {
    return { error: 'Unauthorized: Valid Supabase session required.' }
  }

  const title = input.title.trim()
  const content = input.content.trim()
  if (!title || title.length > 200) {
    return { error: 'Title is required and must be under 200 characters.' }
  }
  if (!content || content.length > 10000) {
    return { error: 'Content is required and must be under 10,000 characters.' }
  }

  const supabase = requireSupabaseClient()
  const { data, error } = await supabase
    .from('user_documents')
    .insert({
      user_id: session.user.id,
      title,
      content,
      classification: input.classification,
      status: 'pending',
      approved: false,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { error: error?.message || 'Failed to save document.' }
  }

  recordAuditActivity({
    userId: session.user.id,
    action: 'CREATE_DOCUMENT',
    metadata: {
      documentId: data.id,
      title,
      classification: input.classification,
    },
  })

  return { document: data }
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
  const session = await waitForAuthReady()
  if (!session) {
    return {
      error:
        'Authentication required: Only registered members can list a project.',
    }
  }

  const supabase = requireSupabaseClient()
  const projectTable = await resolveProjectTable()
  const { data, error } = await supabase
    .from(projectTable)
    .insert({
      user_id: session.user.id,
      title: input.title.trim(),
      mineral: input.mineral.trim(),
      region: input.region.trim(),
      licence_type: input.licenceType.trim(),
      licence_reference: input.licenceReference.trim(),
      investment_usd: Math.max(0, Number(input.investmentUsd) || 0),
      submitted_currency: input.submittedCurrency,
      summary: input.summary.trim(),
      status: 'PENDING_VERIFICATION',
      approved: false,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { error: error?.message || 'Failed to submit project.' }
  }

  recordAdminAuditEvent({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actionType: 'LIST_PROJECT',
    targetTable: `public.${projectTable}`,
    targetId: data.id,
    targetSummary: data.title,
    metadata: {
      projectId: data.id,
      title: data.title,
      mineral: data.mineral,
      investmentUsd: data.investment_usd,
    },
  })

  return { project: data }
}

export async function createGroundedQuoteRequest(input: {
  providerId: string
  providerName: string
  serviceRequested: string
  estimatedBudgetUsd: number
  currencyCode: SupportedCurrency
  scopeNotes: string
}): Promise<{ quote?: QuoteRequestRecord; error?: string }> {
  const session = await waitForAuthReady()
  if (!session) {
    return {
      error:
        'Authentication required: Only registered members can request a service quote.',
    }
  }

  const supabase = requireSupabaseClient()
  const quoteTable = await resolveQuoteTable()
  const { data, error } = await supabase
    .from(quoteTable)
    .insert({
      user_id: session.user.id,
      provider_id: input.providerId,
      provider_name: input.providerName,
      service_requested: input.serviceRequested.trim(),
      estimated_budget_usd: Math.max(0, Number(input.estimatedBudgetUsd) || 0),
      currency_code: input.currencyCode,
      scope_notes: input.scopeNotes.trim(),
      status: 'SUBMITTED',
      approved: false,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { error: error?.message || 'Failed to submit quote request.' }
  }

  recordAdminAuditEvent({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actionType: 'REQUEST_QUOTE',
    targetTable: `public.${quoteTable}`,
    targetId: data.id,
    targetSummary: `${data.service_requested} (${data.provider_name})`,
    metadata: {
      quoteId: data.id,
      providerName: data.provider_name,
      estimatedBudgetUsd: data.estimated_budget_usd,
    },
  })

  return { quote: data }
}

export async function deleteGroundedDocument(
  documentId: string
): Promise<{ error?: string }> {
  const session = await waitForAuthReady()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  const supabase = requireSupabaseClient()
  const { error } = await supabase
    .from('user_documents')
    .delete()
    .eq('id', documentId)
    .eq('user_id', session.user.id)

  if (error) {
    return { error: error.message }
  }

  recordAuditActivity({
    userId: session.user.id,
    action: 'DELETE_DOCUMENT',
    metadata: { documentId },
  })

  return {}
}

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
  const session = await waitForAuthReady()
  if (!session) {
    return {
      error:
        'Authentication required: Please sign in to publish an opportunity.',
    }
  }

  const parsed = OpportunitySubmissionSchema.safeParse({
    ...input,
    verifiedComplianceChecklist: true,
  })
  if (!parsed.success) {
    return { error: parsed.error.message }
  }

  const {
    title,
    organization,
    location,
    deadline,
    description,
    requirements,
  } = parsed.data

  const catPrefix = input.category.slice(0, 3).toUpperCase()
  const refCode = `OPP-${catPrefix}-${Math.floor(1000 + Math.random() * 9000)}`

  const supabase = requireSupabaseClient()
  const { data, error } = await supabase
    .from('opportunities')
    .insert({
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
    })
    .select('*')
    .single()

  if (error || !data) {
    return { error: error?.message || 'Failed to publish opportunity.' }
  }

  recordAdminAuditEvent({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actionType: 'CREATE_OPPORTUNITY',
    targetTable: 'public.opportunities',
    targetId: data.id,
    targetSummary: data.title,
    metadata: {
      opportunityId: data.id,
      referenceCode: data.reference_code,
      title: data.title,
      category: data.category,
      location: data.location,
      status: 'pending',
    },
  })

  return { opportunity: data }
}

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
  const session = await waitForAuthReady()
  if (!session) {
    return {
      error:
        'Authentication required: Please sign in to publish a professional service.',
    }
  }

  const parsed = ServiceSubmissionSchema.safeParse({
    ...input,
    regionalCoverage: input.regionalCoverage.trim() || 'All Tanzania (31 Mikoa)',
    verifiedComplianceChecklist: true,
  })
  if (!parsed.success) {
    return { error: parsed.error.message }
  }

  const {
    serviceName,
    providerOrganization,
    regionalCoverage,
    rateOrPricingModel,
    scopeDescription,
    portfolioLinks,
    certifications,
  } = parsed.data

  const expPrefix = input.expertiseArea.slice(0, 3).toUpperCase()
  const refCode = `SRV-${expPrefix}-${Math.floor(1000 + Math.random() * 9000)}`

  const supabase = requireSupabaseClient()
  const { data, error } = await supabase
    .from('services')
    .insert({
      user_id: session.user.id,
      service_name: serviceName,
      provider_organization: providerOrganization,
      expertise_area: input.expertiseArea,
      regional_coverage: regionalCoverage,
      rate_or_pricing_model: rateOrPricingModel,
      estimated_rate_usd: Math.max(0, Number(input.estimatedRateUsd) || 0),
      scope_description: scopeDescription,
      portfolio_links: sanitizeString(portfolioLinks, 500),
      certifications: sanitizeString(certifications, 500),
      reference_code: refCode,
      status: 'pending',
      approved: false,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { error: error?.message || 'Failed to publish service.' }
  }

  recordAdminAuditEvent({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actionType: 'CREATE_SERVICE',
    targetTable: 'public.services',
    targetId: data.id,
    targetSummary: data.service_name,
    metadata: {
      serviceId: data.id,
      referenceCode: data.reference_code,
      serviceName: data.service_name,
      expertiseArea: data.expertise_area,
      status: 'pending',
    },
  })

  return { service: data }
}

/**
 * Allows an authenticated member to submit company/contact details, target verification
 * tier (`L1`–`L4`), and an optional client-compressed supporting document into the fast
 * verification pipeline (`public.verification_submissions` + `public.profiles`).
 */
const VERIF_DOCS_MANIFEST_PREFIX = '\n\n[MC_VERIF_DOCS]'
const VERIF_DOCS_MANIFEST_SUFFIX = '[/MC_VERIF_DOCS]'

function serializeNotesWithManifest(
  plainNotes: string | null,
  docs: VerificationDocumentMetadata[],
): string | null {
  const trimmed = plainNotes?.trim() || ''
  if (docs.length === 0) return trimmed || null
  const manifest = `${VERIF_DOCS_MANIFEST_PREFIX}${JSON.stringify(docs)}${VERIF_DOCS_MANIFEST_SUFFIX}`
  return `${trimmed}${manifest}`
}

function parseNotesAndManifest(rawNotes: unknown): {
  cleanNotes: string | null
  manifestDocs: VerificationDocumentMetadata[]
} {
  if (typeof rawNotes !== 'string' || !rawNotes) {
    return { cleanNotes: null, manifestDocs: [] }
  }
  const startIdx = rawNotes.indexOf(VERIF_DOCS_MANIFEST_PREFIX)
  if (startIdx === -1) {
    return { cleanNotes: rawNotes.trim() || null, manifestDocs: [] }
  }
  const endIdx = rawNotes.indexOf(VERIF_DOCS_MANIFEST_SUFFIX, startIdx)
  const cleanNotes = rawNotes.slice(0, startIdx).trim() || null
  if (endIdx === -1) {
    return { cleanNotes, manifestDocs: [] }
  }
  const jsonSlice = rawNotes
    .slice(startIdx + VERIF_DOCS_MANIFEST_PREFIX.length, endIdx)
    .trim()
  try {
    const parsed = JSON.parse(jsonSlice)
    if (Array.isArray(parsed)) {
      return {
        cleanNotes,
        manifestDocs: normalizeVerificationDocArray(parsed),
      }
    }
  } catch {
    // ignore malformed manifest
  }
  return { cleanNotes, manifestDocs: [] }
}

function normalizeVerificationDocArray(raw: unknown): VerificationDocumentMetadata[] {
  if (!Array.isArray(raw)) return []
  const out: VerificationDocumentMetadata[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const path = typeof rec.path === 'string' ? rec.path.trim() : ''
    const fileName = typeof rec.fileName === 'string' ? rec.fileName.trim() : ''
    if (!path && !fileName) continue
    out.push({
      slotKey: typeof rec.slotKey === 'string' ? rec.slotKey : `doc_${out.length + 1}`,
      label: typeof rec.label === 'string' && rec.label.trim() ? rec.label.trim() : fileName || 'Supporting Document',
      required: typeof rec.required === 'boolean' ? rec.required : undefined,
      fileName: fileName || path.split('/').pop() || 'document',
      mimeType: typeof rec.mimeType === 'string' ? rec.mimeType : 'application/octet-stream',
      size: typeof rec.size === 'number' && Number.isFinite(rec.size) ? rec.size : 0,
      path,
      url: typeof rec.url === 'string' ? rec.url : null,
    })
  }
  return out
}

export async function submitUserVerificationRequest(input: {
  companyName: string
  phone: string
  notes?: string
  licenceReference?: string
  requestedLevel?: Exclude<VerificationLevelCode, 'L0'>
  preparedFile?: PreparedVerificationFile | null
  preparedDocuments?: Array<{
    slotKey: string
    label: string
    required: boolean
    prepared: PreparedVerificationFile
  }>
}): Promise<{ profile?: UserProfile; submissionId?: string; warning?: string; error?: string }> {
  const session = await waitForAuthReady()
  if (!session) {
    return { error: 'Please sign in before submitting a verification request.' }
  }

  const companyName = input.companyName.trim()
  const phone = input.phone.trim()
  if (!companyName || companyName.length < 2) {
    return { error: 'Company or organization name is required.' }
  }

  const requestedLevel: Exclude<VerificationLevelCode, 'L0'> =
    input.requestedLevel && ['L1', 'L2', 'L3', 'L4'].includes(input.requestedLevel)
      ? input.requestedLevel
      : 'L1'

  const supabase = requireSupabaseClient()
  const profileTable = await resolveProfileTable()

  const docsToUpload: Array<{
    slotKey: string
    label: string
    required: boolean
    prepared: PreparedVerificationFile
  }> =
    input.preparedDocuments && input.preparedDocuments.length > 0
      ? input.preparedDocuments
      : input.preparedFile
        ? [
            {
              slotKey: 'supporting_document',
              label: 'Supporting Document',
              required: false,
              prepared: input.preparedFile,
            },
          ]
        : []

  const uploadedDocs: VerificationDocumentMetadata[] = []
  const failedUploads: string[] = []

  if (docsToUpload.length > 0) {
    const batchTs = Date.now()
    const uploadResults = await Promise.all(
      docsToUpload.map(async (item, idx) => {
        const safeSlot = item.slotKey.replace(/[^a-zA-Z0-9_-]/g, '_')
        const objectPath = `${session.user.id}/${requestedLevel}/${batchTs}-${idx}-${safeSlot}-${item.prepared.fileName}`
        const { error: uploadErr } = await supabase.storage
          .from(VERIFICATION_STORAGE_BUCKET)
          .upload(objectPath, item.prepared.blob, {
            contentType: item.prepared.mimeType,
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadErr) {
          console.warn(
            `[MineConnect Verification] Storage upload failed for ${item.label}:`,
            uploadErr.message,
          )
          return { ok: false as const, label: item.label, error: uploadErr.message }
        }

        return {
          ok: true as const,
          meta: {
            slotKey: item.slotKey,
            label: item.label,
            required: item.required,
            fileName: item.prepared.fileName,
            mimeType: item.prepared.mimeType,
            size: item.prepared.compressedBytes,
            path: objectPath,
            url: null,
          } satisfies VerificationDocumentMetadata,
        }
      }),
    )

    for (const r of uploadResults) {
      if (r.ok) {
        uploadedDocs.push(r.meta)
      } else {
        failedUploads.push(r.label)
      }
    }
  }

  let uploadWarning: string | undefined
  if (failedUploads.length > 0) {
    uploadWarning = `Verification request recorded, but ${failedUploads.length} document(s) (${failedUploads.join(', ')}) could not be uploaded to storage. Please retry or contact support.`
  }

  const primaryDoc = uploadedDocs[0] ?? null
  const plainNotes = input.notes?.trim() || null

  // Insert verification queue record with structured `documents` JSONB array
  // (gracefully falls back to manifest-in-notes if migration 20261126000002 is still deploying)
  let submissionId: string | undefined
  const baseInsertPayload = {
    user_id: session.user.id,
    requested_level: requestedLevel,
    status: 'pending' as const,
    company_name: companyName,
    phone: phone || null,
    licence_reference: input.licenceReference?.trim() || null,
    notes: plainNotes,
    document_name: primaryDoc?.fileName ?? null,
    document_mime: primaryDoc?.mimeType ?? null,
    document_size_bytes: primaryDoc?.size ?? null,
    document_storage_path: primaryDoc?.path ?? null,
    documents: uploadedDocs as unknown as Json,
  }

  let { data: subRow, error: subErr } = await supabase
    .from('verification_submissions')
    .insert(baseInsertPayload as never)
    .select('id')
    .single()

  if (
    subErr &&
    !isMissingRelationError(subErr) &&
    /documents|column|schema cache/i.test(subErr.message ?? '')
  ) {
    const fallbackInsertPayload = {
      user_id: session.user.id,
      requested_level: requestedLevel,
      status: 'pending' as const,
      company_name: companyName,
      phone: phone || null,
      licence_reference: input.licenceReference?.trim() || null,
      notes: serializeNotesWithManifest(plainNotes, uploadedDocs),
      document_name: primaryDoc?.fileName ?? null,
      document_mime: primaryDoc?.mimeType ?? null,
      document_size_bytes: primaryDoc?.size ?? null,
      document_storage_path: primaryDoc?.path ?? null,
    }
    const retryRes = await supabase
      .from('verification_submissions')
      .insert(fallbackInsertPayload)
      .select('id')
      .single()
    subRow = retryRes.data
    subErr = retryRes.error
  }

  if (!subErr && subRow?.id) {
    submissionId = String(subRow.id)
  } else if (subErr && !isMissingRelationError(subErr)) {
    console.warn('[MineConnect Verification] Queue insert warning:', subErr.message)
  }

  const combinedNotes = [
    `Requested ${requestedLevel} (${VERIFICATION_LEVELS[requestedLevel].title})`,
    input.licenceReference?.trim() ? `Ref: ${input.licenceReference.trim()}` : '',
    plainNotes || '',
    uploadedDocs.length > 0
      ? `Docs (${uploadedDocs.length}): ${uploadedDocs.map((d) => d.label).join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join(' · ')

  const { data, error } = await supabase
    .from(profileTable)
    .update({
      company_name: companyName,
      phone: phone || null,
      verification_status: 'pending',
      verification_notes: combinedNotes || null,
    })
    .eq('id', session.user.id)
    .select('*')
    .single()

  if (error || !data) {
    console.error('[MineConnect Verification] Request failed:', error)
    return { error: error?.message || 'Unable to submit verification request.' }
  }

  const normalized = normalizeProfileRow(
    data as unknown as Record<string, unknown>,
    session.user.id
  )
  setCurrentSession(session, normalized)

  recordAdminAuditEvent({
    actorId: session.user.id,
    actorEmail: session.user.email,
    actionType: 'USER_VERIFICATION_REQUESTED',
    targetTable: `public.${profileTable}`,
    targetId: session.user.id,
    targetSummary: `${normalized.full_name || normalized.email} (${companyName} · ${requestedLevel})`,
    metadata: {
      companyName,
      phone,
      requestedLevel,
      submissionId: submissionId ?? null,
      documentCount: uploadedDocs.length,
      hasDocument: uploadedDocs.length > 0,
    },
  })

  return { profile: normalized, submissionId, warning: uploadWarning }
}

/**
 * Lazy-loads full verification submission notes and short-lived signed storage preview URLs
 * for every attached labeled document ONLY when an administrator expands a submission row.
 */
export async function fetchVerificationSubmissionPreview(
  submissionId: string,
): Promise<{ preview?: VerificationSubmissionPreview; error?: string }> {
  const adminCheck = await verifyActiveAdmin()
  if (!adminCheck.authorized) {
    return { error: adminCheck.error }
  }

  const supabase = requireSupabaseClient()
  const { data, error } = await supabase
    .from('verification_submissions')
    .select('*')
    .eq('id', submissionId)
    .maybeSingle()

  if (error || !data) {
    return { error: error?.message || 'Verification submission not found.' }
  }

  const row = data as unknown as Record<string, unknown>
  const { cleanNotes, manifestDocs } = parseNotesAndManifest(row.notes)
  const columnDocs = normalizeVerificationDocArray(row.documents)

  const legacyPath =
    typeof row.document_storage_path === 'string' && row.document_storage_path.trim()
      ? row.document_storage_path.trim()
      : null

  const structuredDocs: VerificationDocumentMetadata[] =
    columnDocs.length > 0
      ? columnDocs
      : manifestDocs.length > 0
        ? manifestDocs
        : legacyPath
          ? [
              {
                slotKey: 'supporting_document',
                label: 'Supporting Document',
                fileName:
                  typeof row.document_name === 'string' && row.document_name
                    ? row.document_name
                    : legacyPath.split('/').pop() || 'Document',
                mimeType:
                  typeof row.document_mime === 'string' && row.document_mime
                    ? row.document_mime
                    : 'application/octet-stream',
                size:
                  typeof row.document_size_bytes === 'number'
                    ? row.document_size_bytes
                    : 0,
                path: legacyPath,
                url: null,
              },
            ]
          : []

  const documentPreviews: VerificationSubmissionDocumentPreview[] = await Promise.all(
    structuredDocs.map(async (doc) => {
      if (!doc.path) {
        return {
          ...doc,
          signedUrl: doc.url ?? null,
          warning: doc.url ? null : 'Storage path missing for this document.',
        }
      }
      const { data: signedData, error: signErr } = await supabase.storage
        .from(VERIFICATION_STORAGE_BUCKET)
        .createSignedUrl(doc.path, 300)
      if (signErr) {
        return {
          ...doc,
          signedUrl: null,
          warning: `Preview unavailable: ${signErr.message}`,
        }
      }
      return {
        ...doc,
        signedUrl: signedData?.signedUrl ?? null,
        warning: null,
      }
    }),
  )

  const primaryPreview = documentPreviews[0] ?? null

  return {
    preview: {
      id: String(row.id),
      notes: cleanNotes,
      reviewer_notes:
        typeof row.reviewer_notes === 'string' ? row.reviewer_notes : null,
      document_name:
        primaryPreview?.fileName ??
        (typeof row.document_name === 'string' ? row.document_name : null),
      document_mime:
        primaryPreview?.mimeType ??
        (typeof row.document_mime === 'string' ? row.document_mime : null),
      document_size_bytes:
        primaryPreview?.size ??
        (typeof row.document_size_bytes === 'number'
          ? row.document_size_bytes
          : null),
      signedUrl: primaryPreview?.signedUrl ?? null,
      documents: documentPreviews,
      warning: primaryPreview?.warning ?? null,
    },
  }
}

/**
 * Admin Action: Set a user's `L0`–`L4` verification level (decoupled from subscription plans)
 * and/or approve, reject, or revoke their verification status with optional reviewer notes.
 */
export async function adminSetUserVerificationLevel(params: {
  targetUserId: string
  verificationLevel: VerificationLevelCode
  decision?: 'VERIFY' | 'REJECT' | 'REVOKE' | 'SET_LEVEL'
  notes?: string
  submissionId?: string
}): Promise<{ user?: UserProfile; error?: string }> {
  const adminCheck = await verifyActiveAdmin()
  if (!adminCheck.authorized) {
    return { error: adminCheck.error }
  }

  const supabase = requireSupabaseClient()
  const profileTable = await resolveProfileTable()
  const levelCode = normalizeVerificationLevel(params.verificationLevel)
  const decision = params.decision ?? (levelCode === 'L0' ? 'REVOKE' : 'SET_LEVEL')

  const nextStatus: UserVerificationStatus =
    decision === 'REJECT'
      ? 'rejected'
      : decision === 'REVOKE' || levelCode === 'L0'
        ? 'unverified'
        : 'verified'

  const effectiveLevel: VerificationLevelCode =
    decision === 'REJECT' || decision === 'REVOKE' ? 'L0' : levelCode

  const nowIso = new Date().toISOString()
  const cleanNotes = params.notes?.trim() || null

  const updatePayload = {
    verification_status: nextStatus,
    verification_level: effectiveLevel,
    verification_notes: cleanNotes,
    verified_at: nextStatus === 'verified' ? nowIso : null,
    verified_by: nextStatus === 'verified' ? adminCheck.userId : null,
  }

  let { data, error } = await supabase
    .from(profileTable)
    .update(updatePayload as never)
    .eq('id', params.targetUserId)
    .select('*')
    .single()

  // Graceful fallback if `verification_level` column is not yet migrated in remote DB
  if (error && /verification_level|42703/i.test(`${error.code ?? ''} ${error.message}`)) {
    const fallbackPayload = {
      verification_status: nextStatus,
      verification_notes: cleanNotes,
      verified_at: nextStatus === 'verified' ? nowIso : null,
      verified_by: nextStatus === 'verified' ? adminCheck.userId : null,
    }
    const retry = await supabase
      .from(profileTable)
      .update(fallbackPayload)
      .eq('id', params.targetUserId)
      .select('*')
      .single()
    data = retry.data
    error = retry.error
  }

  if (error || !data) {
    console.error('[MineConnect Admin] Verification level update failed:', error)
    return { error: error?.message || 'Failed to update verification level.' }
  }

  // Sync matching verification_submissions queue rows cleanly
  const submissionStatus: 'approved' | 'rejected' =
    decision === 'REJECT'
      ? 'rejected'
      : nextStatus === 'verified'
        ? 'approved'
        : 'rejected'

  const subUpdateQuery = supabase
    .from('verification_submissions')
    .update({
      status: submissionStatus,
      reviewer_notes: cleanNotes,
      reviewed_by: adminCheck.userId,
      reviewed_at: nowIso,
      updated_at: nowIso,
    })

  if (params.submissionId) {
    await subUpdateQuery.eq('id', params.submissionId)
  } else {
    await subUpdateQuery
      .eq('user_id', params.targetUserId)
      .eq('status', 'pending')
  }

  const normalized = normalizeProfileRow(
    { ...(data as unknown as Record<string, unknown>), verification_level: effectiveLevel },
    params.targetUserId,
  )

  const actionType =
    decision === 'REJECT'
      ? 'ADMIN_REJECT_VERIFICATION'
      : decision === 'REVOKE'
        ? 'ADMIN_REVOKE_VERIFICATION'
        : `ADMIN_SET_VERIFICATION_${effectiveLevel}`

  recordAdminAuditEvent({
    actorId: adminCheck.userId,
    actorEmail: currentSession?.user.email ?? null,
    actionType,
    targetTable: `public.${profileTable}`,
    targetId: normalized.id,
    targetSummary: `${normalized.full_name || normalized.email} → ${effectiveLevel} (${VERIFICATION_LEVELS[effectiveLevel].title})`,
    metadata: {
      targetEmail: normalized.email,
      verificationStatus: nextStatus,
      verificationLevel: effectiveLevel,
      notes: cleanNotes,
    },
  })

  return { user: normalized }
}

/**
 * Admin Action: Verify, Reject, or Revoke a user's identity verification status in `public.profiles`.
 */
export async function adminVerifyUserProfile(params: {
  targetUserId: string
  decision: 'VERIFY' | 'REJECT' | 'REVOKE'
  verificationLevel?: VerificationLevelCode
  notes?: string
  submissionId?: string
}): Promise<{ user?: UserProfile; error?: string }> {
  const targetLevel: VerificationLevelCode =
    params.decision === 'VERIFY'
      ? params.verificationLevel && params.verificationLevel !== 'L0'
        ? params.verificationLevel
        : 'L1'
      : 'L0'

  return adminSetUserVerificationLevel({
    targetUserId: params.targetUserId,
    verificationLevel: targetLevel,
    decision: params.decision,
    notes: params.notes,
    submissionId: params.submissionId,
  })
}

/**
 * Unified Admin Moderation Action supporting Approve, Reject (with reason),
 * Hide/Unpublish, and Feature toggle across Services, Opportunities, Projects, Quotes.
 */
export async function adminModerateEntity(params: {
  id: string
  type: 'SERVICE' | 'OPPORTUNITY' | 'PROJECT' | 'QUOTE'
  action: 'APPROVE' | 'REJECT' | 'HIDE' | 'TOGGLE_FEATURED'
  reason?: string
  title?: string
  currentFeatured?: boolean
}): Promise<{ success?: boolean; error?: string }> {
  const adminCheck = await verifyActiveAdmin()
  if (!adminCheck.authorized) {
    return { error: adminCheck.error }
  }

  const supabase = requireSupabaseClient()
  const nowIso = new Date().toISOString()
  const [projectTable, quoteTable] = await Promise.all([
    resolveProjectTable(),
    resolveQuoteTable(),
  ])

  const targetTable =
    params.type === 'SERVICE'
      ? 'services'
      : params.type === 'OPPORTUNITY'
        ? 'opportunities'
        : params.type === 'PROJECT'
          ? projectTable
          : quoteTable

  let patch: Record<string, unknown> = {}
  let actionType = `ADMIN_${params.action}_${params.type}`

  if (params.action === 'TOGGLE_FEATURED') {
    patch = { is_featured: !params.currentFeatured }
    actionType = !params.currentFeatured
      ? `ADMIN_FEATURE_${params.type}`
      : `ADMIN_UNFEATURE_${params.type}`
  } else if (params.action === 'APPROVE') {
    patch = {
      status:
        params.type === 'PROJECT'
          ? 'VERIFIED'
          : params.type === 'QUOTE'
            ? 'QUOTED'
            : 'approved',
      approved: true,
      rejection_reason: null,
      moderation_notes:
        params.reason?.trim() || 'Approved & published by Admin Governance.',
      reviewed_by: adminCheck.userId,
      reviewed_at: nowIso,
    }
  } else if (params.action === 'REJECT') {
    const reasonText =
      params.reason?.trim() || 'Rejected during administrative compliance review.'
    patch = {
      status:
        params.type === 'PROJECT' || params.type === 'QUOTE'
          ? 'REJECTED'
          : 'rejected',
      approved: false,
      rejection_reason: reasonText,
      moderation_notes: reasonText,
      reviewed_by: adminCheck.userId,
      reviewed_at: nowIso,
    }
  } else if (params.action === 'HIDE') {
    patch = {
      status:
        params.type === 'PROJECT'
          ? 'ARCHIVED'
          : params.type === 'QUOTE'
            ? 'CLOSED'
            : 'hidden',
      approved: false,
      moderation_notes:
        params.reason?.trim() || 'Hidden from public directory by administrator.',
      reviewed_by: adminCheck.userId,
      reviewed_at: nowIso,
    }
  }

  const { error } = await supabase
    .from(targetTable)
    .update(patch as never)
    .eq('id', params.id)

  if (error) {
    console.error(`[MineConnect Admin] Failed moderating ${targetTable}/${params.id}:`, error)
    return { error: error.message }
  }

  recordAdminAuditEvent({
    actorId: adminCheck.userId,
    actorEmail: currentSession?.user.email ?? null,
    actionType,
    targetTable: `public.${targetTable}`,
    targetId: params.id,
    targetSummary: params.title || params.id,
    metadata: {
      action: params.action,
      reason: params.reason?.trim() || null,
      featured: params.action === 'TOGGLE_FEATURED' ? !params.currentFeatured : undefined,
    },
  })

  return { success: true }
}

/**
 * Public Marketplace Feed: Loads live admin-approved Services directly from `public.services`.
 * RLS guarantees only `approved = true` rows are visible to public visitors.
 */
export async function fetchApprovedPublicServices(): Promise<UserServiceRecord[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('approved', true)
    .in('status', ['approved', 'active'])
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    if (!isMissingRelationError(error)) {
      console.error('[MineConnect Public] Failed fetching approved services:', error)
    }
    return []
  }

  return data ?? []
}

/**
 * Public Marketplace Feed: Loads live admin-approved Opportunities & Projects from Supabase.
 * RLS guarantees only `approved = true` rows are visible to public visitors.
 */
export async function fetchApprovedPublicOpportunities(): Promise<{
  opportunities: UserOpportunityRecord[]
  projects: UserListedProject[]
}> {
  const supabase = getSupabaseClient()
  if (!supabase) return { opportunities: [], projects: [] }

  const projectTable = await resolveProjectTable()
  const [oppsRes, projectsRes] = await Promise.all([
    supabase
      .from('opportunities')
      .select('*')
      .eq('approved', true)
      .in('status', ['approved', 'active'])
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from(projectTable)
      .select('*')
      .eq('approved', true)
      .in('status', ['approved', 'VERIFIED'])
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (oppsRes.error && !isMissingRelationError(oppsRes.error)) {
    console.error('[MineConnect Public] Failed fetching approved opportunities:', oppsRes.error)
  }
  if (projectsRes.error && !isMissingRelationError(projectsRes.error)) {
    console.error('[MineConnect Public] Failed fetching approved projects:', projectsRes.error)
  }

  return {
    opportunities: oppsRes.data ?? [],
    projects: projectsRes.data ?? [],
  }
}

/**
 * Public / Member Compliance Complaint Submission (`public.compliance_complaints`).
 */
export async function submitComplianceComplaint(params: {
  reporterEmail: string
  category: ComplianceComplaintCategory
  referenceCode?: string
  description: string
}): Promise<{ ok: boolean; trackingId?: string; error?: string }> {
  const reporterEmail = params.reporterEmail.trim().toLowerCase()
  const referenceCode = sanitizeString(params.referenceCode?.trim() || '', 160)
  const description = sanitizeString(params.description.trim(), 4000)

  if (!reporterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) {
    return { ok: false, error: 'Please enter a valid reporter email address.' }
  }
  if (description.length < 15) {
    return {
      ok: false,
      error: 'Please provide at least 15 characters describing the compliance or listing issue.',
    }
  }

  let supabase
  try {
    supabase = requireSupabaseClient()
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Supabase is not configured.',
    }
  }

  const reporterUserId = currentSession?.user.id ?? null

  const { error } = await supabase.from('compliance_complaints').insert({
    reporter_user_id: reporterUserId,
    reporter_email: reporterEmail,
    category: params.category,
    reference_code: referenceCode || null,
    description,
    status: 'open',
  })

  if (error) {
    console.error('[MineConnect Compliance] Failed submitting complaint:', error)
    return {
      ok: false,
      error: isMissingRelationError(error)
        ? 'Compliance complaints table is awaiting database migration. Please run the latest SQL migration in Supabase.'
        : error.message,
    }
  }

  const trackingId = `CMP-${Math.floor(100000 + Math.random() * 899999)}`
  return { ok: true, trackingId }
}

/**
 * Admin Governance: Fetches all rows from `public.compliance_complaints`.
 */
export async function fetchAdminComplianceComplaints(): Promise<{
  complaints: ComplianceComplaintRecord[]
  error?: string
}> {
  const adminCheck = await verifyActiveAdmin()
  if (!adminCheck.authorized) {
    return { complaints: [], error: adminCheck.error }
  }

  const supabase = getSupabaseClient()
  if (!supabase) return { complaints: [] }

  const { data, error } = await supabase
    .from('compliance_complaints')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    if (isMissingRelationError(error)) {
      return {
        complaints: [],
        error:
          'Compliance complaints table not yet created. Run supabase/migrations/202611230002_legal_compliance_complaints.sql in Supabase SQL Editor.',
      }
    }
    return { complaints: [], error: error.message }
  }

  return { complaints: (data ?? []) as ComplianceComplaintRecord[] }
}

/**
 * Admin Governance: Updates status & resolution notes on a compliance complaint
 * and records an immutable audit event.
 */
export async function adminUpdateComplaintStatus(params: {
  id: string
  status: ComplianceComplaintStatus
  resolutionNotes?: string
  summary?: string
}): Promise<{ success?: boolean; error?: string }> {
  const adminCheck = await verifyActiveAdmin()
  if (!adminCheck.authorized) {
    return { error: adminCheck.error }
  }

  const supabase = getSupabaseClient()
  if (!supabase) return { error: 'Supabase client is not configured.' }

  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('compliance_complaints')
    .update({
      status: params.status,
      resolution_notes: params.resolutionNotes?.trim() || null,
      reviewed_by: adminCheck.userId,
      reviewed_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', params.id)

  if (error) {
    console.error('[MineConnect Admin] Failed updating compliance complaint:', error)
    return { error: error.message }
  }

  recordAdminAuditEvent({
    actorId: adminCheck.userId,
    actorEmail: currentSession?.user.email ?? null,
    actionType: `COMPLAINT_MARKED_${params.status.toUpperCase()}`,
    targetTable: 'public.compliance_complaints',
    targetId: params.id,
    targetSummary: params.summary || params.id,
    metadata: {
      status: params.status,
      resolutionNotes: params.resolutionNotes?.trim() || null,
    },
  })

  return { success: true }
}
