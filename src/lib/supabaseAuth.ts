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
import type {
  AdminAuditLogRecord,
  AuditAction,
  AuditLog,
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
  sdkSession: SupabaseSdkSession | null
): Promise<AuthSession | null> {
  if (!sdkSession?.user) {
    profileLoading = false
    currentProfileError = null
    setCurrentSession(null, null)
    return null
  }

  profileLoading = true
  notifyAuthListeners()

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
    profileLoading = false
    notifyAuthListeners()
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

      profileLoading = true
      notifyAuthListeners()

      window.setTimeout(() => {
        void hydrateFromSupabaseSession(nextSdkSession).finally(() => {
          authLoading = false
          profileLoading = false
          notifyAuthListeners()
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
}): Promise<{ session?: AuthSession; confirmationRequired?: boolean; error?: string }> {
  const email = params.email.trim().toLowerCase()
  const { password, confirmPassword } = params
  const fullName = params.fullName?.trim() || email.split('@')[0]
  const preferredCurrency = params.preferredCurrency || 'USD'

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
  rawEmail: string
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
  })

  if (error) {
    // Log internally for operators, but never disclose account existence to the requester
    console.warn('[MineConnect Auth] Password reset request warning:', error.message)
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

  const [
    profilesRes,
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
      .select('*')
      .order('created_at', { ascending: false }),
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
 * Allows an authenticated member to submit company/contact details and request
 * official Identity Verification (`verification_status = 'pending'`) in `public.profiles`.
 */
export async function submitUserVerificationRequest(input: {
  companyName: string
  phone: string
  notes?: string
}): Promise<{ profile?: UserProfile; error?: string }> {
  const session = await waitForAuthReady()
  if (!session) {
    return { error: 'Please sign in before submitting a verification request.' }
  }

  const companyName = input.companyName.trim()
  const phone = input.phone.trim()
  if (!companyName || companyName.length < 2) {
    return { error: 'Company or organization name is required.' }
  }

  const supabase = requireSupabaseClient()
  const profileTable = await resolveProfileTable()
  const { data, error } = await supabase
    .from(profileTable)
    .update({
      company_name: companyName,
      phone: phone || null,
      verification_status: 'pending',
      verification_notes: input.notes?.trim() || null,
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
    targetSummary: `${normalized.full_name || normalized.email} (${companyName})`,
    metadata: { companyName, phone },
  })

  return { profile: normalized }
}

/**
 * Admin Action: Verify, Reject, or Revoke a user's identity verification status in `public.profiles`.
 */
export async function adminVerifyUserProfile(params: {
  targetUserId: string
  decision: 'VERIFY' | 'REJECT' | 'REVOKE'
  notes?: string
}): Promise<{ user?: UserProfile; error?: string }> {
  const adminCheck = await verifyActiveAdmin()
  if (!adminCheck.authorized) {
    return { error: adminCheck.error }
  }

  const supabase = requireSupabaseClient()
  const profileTable = await resolveProfileTable()
  const nextStatus: UserVerificationStatus =
    params.decision === 'VERIFY'
      ? 'verified'
      : params.decision === 'REJECT'
        ? 'rejected'
        : 'unverified'

  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from(profileTable)
    .update({
      verification_status: nextStatus,
      verification_notes: params.notes?.trim() || null,
      verified_at: params.decision === 'VERIFY' ? nowIso : null,
      verified_by: params.decision === 'VERIFY' ? adminCheck.userId : null,
    })
    .eq('id', params.targetUserId)
    .select('*')
    .single()

  if (error || !data) {
    console.error('[MineConnect Admin] Verification update failed:', error)
    return { error: error?.message || 'Failed to update verification status.' }
  }

  const normalized = normalizeProfileRow(
    data as unknown as Record<string, unknown>,
    params.targetUserId
  )

  const actionType =
    params.decision === 'VERIFY'
      ? 'ADMIN_VERIFY_USER'
      : params.decision === 'REJECT'
        ? 'ADMIN_REJECT_VERIFICATION'
        : 'ADMIN_REVOKE_VERIFICATION'

  recordAdminAuditEvent({
    actorId: adminCheck.userId,
    actorEmail: currentSession?.user.email ?? null,
    actionType,
    targetTable: `public.${profileTable}`,
    targetId: normalized.id,
    targetSummary: `${normalized.full_name || normalized.email} → ${nextStatus}`,
    metadata: {
      targetEmail: normalized.email,
      verificationStatus: nextStatus,
      notes: params.notes?.trim() || null,
    },
  })

  return { user: normalized }
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
