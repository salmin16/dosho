import { useEffect, useState } from 'react'
import type { DocumentClassification, UserDocument, UserProfile } from '../types/database'

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: 'authenticated'
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
const AUTH_EVENT = 'mineconnect:auth-changed'

interface StoredAccount {
  id: string
  email: string
  fullName: string
  passwordHash: string
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

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
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

export async function signUpWithEmail(params: {
  email: string
  password: string
  confirmPassword: string
  fullName?: string
}): Promise<{ session?: AuthSession; error?: string }> {
  const email = params.email.trim().toLowerCase()
  const { password, confirmPassword } = params
  const fullName = params.fullName?.trim() || email.split('@')[0]

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
        data: { full_name: fullName },
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
          role: 'authenticated',
          createdAt: data.user.created_at || new Date().toISOString(),
        },
      }
      saveSession(session)
      return { session }
    }
  }

  // Grounded local database mode (mirrors PostgreSQL auth.users + public.user_profiles trigger)
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
    createdAt: now,
  }
  users.push(newUser)
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users))

  // Provision user_profiles row & starter grounded document
  const rawProfiles = window.localStorage.getItem(PROFILES_KEY)
  const profiles: UserProfile[] = rawProfiles ? JSON.parse(rawProfiles) : []
  profiles.push({
    id: newUser.id,
    email: newUser.email,
    full_name: newUser.fullName,
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
      role: 'authenticated',
      createdAt: now,
    },
  }
  saveSession(session)
  return { session }
}

export async function signInWithEmail(params: {
  email: string
  password: string
}): Promise<{ session?: AuthSession; error?: string }> {
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
      return { error: 'Invalid email or password. Please try again.' }
    }
    const session: AuthSession = {
      accessToken: data.access_token,
      mode: 'supabase',
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name || email.split('@')[0],
        role: 'authenticated',
        createdAt: data.user.created_at || new Date().toISOString(),
      },
    }
    saveSession(session)
    return { session }
  }

  const rawUsers = window.localStorage.getItem(USERS_KEY)
  const users: StoredAccount[] = rawUsers ? JSON.parse(rawUsers) : []
  const passwordHash = await sha256(`${email}:${password}`)
  const account = users.find((u) => u.email === email && u.passwordHash === passwordHash)

  if (!account) {
    return { error: 'Invalid email or password. Please try again.' }
  }

  const session: AuthSession = {
    accessToken: `mc_jwt_${generateUuid()}`,
    mode: 'grounded-local',
    user: {
      id: account.id,
      email: account.email,
      fullName: account.fullName,
      role: 'authenticated',
      createdAt: account.createdAt,
    },
  }
  saveSession(session)
  return { session }
}

export function signOutUser() {
  saveSession(null)
}

/**
 * RLS-Grounded Query: Returns strictly rows where `user_id === session.user.id`
 * (`USING (auth.uid() = user_id)`)
 */
export async function fetchGroundedUserData(): Promise<{
  profile: UserProfile | null
  documents: UserDocument[]
}> {
  const session = getSession()
  if (!session) {
    return { profile: null, documents: [] }
  }

  const supa = getSupabaseConfig()
  if (supa && session.mode === 'supabase') {
    const headers = {
      apikey: supa.anonKey,
      Authorization: `Bearer ${session.accessToken}`,
    }
    const [profRes, docsRes] = await Promise.all([
      fetch(`${supa.url}/rest/v1/user_profiles?id=eq.${session.user.id}&select=*`, { headers }),
      fetch(
        `${supa.url}/rest/v1/user_documents?user_id=eq.${session.user.id}&select=*&order=created_at.desc`,
        { headers }
      ),
    ])
    const profiles = profRes.ok ? ((await profRes.json()) as UserProfile[]) : []
    const documents = docsRes.ok ? ((await docsRes.json()) as UserDocument[]) : []
    return { profile: profiles[0] ?? null, documents }
  }

  const rawProfiles = window.localStorage.getItem(PROFILES_KEY)
  const profiles: UserProfile[] = rawProfiles ? JSON.parse(rawProfiles) : []
  const profile = profiles.find((p) => p.id === session.user.id) ?? {
    id: session.user.id,
    email: session.user.email,
    full_name: session.user.fullName,
    created_at: session.user.createdAt,
    updated_at: session.user.createdAt,
  }

  const rawDocs = window.localStorage.getItem(DOCUMENTS_KEY)
  const allDocs: UserDocument[] = rawDocs ? JSON.parse(rawDocs) : []
  // Enforce RLS policy: USING (auth.uid() = user_id)
  const documents = allDocs
    .filter((d) => d.user_id === session.user.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return { profile, documents }
}

/**
 * RLS-Grounded Insert: Enforces `WITH CHECK (auth.uid() = user_id)`
 */
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

  const supa = getSupabaseConfig()
  if (supa && session.mode === 'supabase') {
    const res = await fetch(`${supa.url}/rest/v1/user_documents`, {
      method: 'POST',
      headers: {
        apikey: supa.anonKey,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        user_id: session.user.id,
        title,
        content,
        classification: input.classification,
      }),
    })
    if (!res.ok) {
      return { error: 'Failed to save document to Supabase.' }
    }
    const created = (await res.json()) as UserDocument[]
    return { document: created[0] }
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
  return { document: newDoc }
}

/**
 * RLS-Grounded Delete: Enforces `USING (auth.uid() = user_id)`
 */
export async function deleteGroundedDocument(documentId: string): Promise<{ error?: string }> {
  const session = getSession()
  if (!session) {
    return { error: 'Unauthorized' }
  }

  const supa = getSupabaseConfig()
  if (supa && session.mode === 'supabase') {
    const res = await fetch(
      `${supa.url}/rest/v1/user_documents?id=eq.${documentId}&user_id=eq.${session.user.id}`,
      {
        method: 'DELETE',
        headers: {
          apikey: supa.anonKey,
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    )
    if (!res.ok) {
      return { error: 'Could not delete document.' }
    }
    return {}
  }

  const rawDocs = window.localStorage.getItem(DOCUMENTS_KEY)
  const allDocs: UserDocument[] = rawDocs ? JSON.parse(rawDocs) : []
  const filtered = allDocs.filter(
    (d) => !(d.id === documentId && d.user_id === session.user.id)
  )
  window.localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(filtered))
  return {}
}
