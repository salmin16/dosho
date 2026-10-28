import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import {
  FileText,
  Lock,
  LogOut,
  PlusCircle,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import {
  createGroundedDocument,
  deleteGroundedDocument,
  fetchGroundedUserData,
  getSession,
  signOutUser,
  useAuthSession,
} from '../lib/supabaseAuth'
import { useSavedIds } from '../lib/saved'
import { PROJECTS } from '../data/fixtures'
import type {
  DocumentClassification,
  UserDocument,
  UserProfile,
} from '../types/database'

export const Route = createFileRoute('/dashboard')({
  component: DashboardRouteComponent,
})

function DashboardRouteComponent() {
  const navigate = useNavigate()
  const session = useAuthSession()
  const { ids: savedProjectIds } = useSavedIds()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [documents, setDocuments] = useState<UserDocument[]>([])
  const [title, setTitle] = useState('')
  const [classification, setClassification] =
    useState<DocumentClassification>('CONFIDENTIAL')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    const data = await fetchGroundedUserData()
    setProfile(data.profile)
    setDocuments(data.documents)
  }, [])

  useEffect(() => {
    const current = getSession()
    if (!current) {
      navigate({ to: '/login' })
      return
    }
    loadData()
  }, [navigate, loadData])

  if (!session) {
    return null
  }

  const savedProjects = PROJECTS.filter((p) => savedProjectIds.includes(p.id))

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await createGroundedDocument({
        title,
        content,
        classification,
      })
      if (res.error) {
        setError(res.error)
      } else {
        setTitle('')
        setContent('')
        setClassification('CONFIDENTIAL')
        await loadData()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteGroundedDocument(id)
    await loadData()
  }

  const handleSignOut = () => {
    signOutUser()
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen bg-paper pb-24 pt-28 text-ink">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        {/* Grounded Session Header */}
        <div className="flex flex-col justify-between gap-6 rounded-xl border border-ink/10 bg-ink p-6 text-paper sm:flex-row sm:items-center lg:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-moss/30 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-gold">
              <ShieldCheck size={14} />
              RLS Policy Active: auth.uid() = user_id
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold">
              Welcome, {profile?.full_name || session.user.fullName}
            </h1>
            <p className="mt-1 text-sm text-paper/75">
              Authenticated Email: <span className="font-mono">{session.user.email}</span> · User UUID:{' '}
              <span className="font-mono text-gold">{session.user.id}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 self-start rounded-md border border-paper/20 bg-paper/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-paper transition hover:bg-paper/20 sm:self-auto"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>

        {/* Main Vault Grid */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Create Grounded Record */}
          <section className="rounded-xl border border-ink/10 bg-paper-2/70 p-6">
            <div className="flex items-center gap-2 text-ochre">
              <PlusCircle size={18} />
              <h2 className="font-display text-xl font-semibold text-ink">
                New Grounded Record
              </h2>
            </div>
            <p className="mt-1 text-xs text-stone">
              Records are strictly bound to <code className="font-mono text-ink">user_id = {session.user.id.slice(0, 8)}…</code>
            </p>

            {error && (
              <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div>
                <label htmlFor="doc-title" className="label">
                  Document / Dossier Title
                </label>
                <input
                  id="doc-title"
                  type="text"
                  required
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Kahama Drill Core Assay Verification"
                  className="field"
                />
              </div>

              <div>
                <label htmlFor="doc-class" className="label">
                  Security Classification
                </label>
                <select
                  id="doc-class"
                  value={classification}
                  onChange={(e) =>
                    setClassification(e.target.value as DocumentClassification)
                  }
                  className="field"
                >
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="INTERNAL">INTERNAL</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                  <option value="RESTRICTED">RESTRICTED</option>
                </select>
              </div>

              <div>
                <label htmlFor="doc-content" className="label">
                  Grounded Notes &amp; Due-Diligence Payload
                </label>
                <textarea
                  id="doc-content"
                  rows={4}
                  required
                  maxLength={10000}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter private geological findings, license numbers, or term-sheet notes..."
                  className="field"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full disabled:opacity-50"
              >
                <Lock size={15} />
                {saving ? 'Encrypting & Saving...' : 'Save to Grounded Vault'}
              </button>
            </form>
          </section>

          {/* Grounded Documents List */}
          <section className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-ink/10 bg-paper-2/50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-ochre" />
                  <h2 className="font-display text-xl font-semibold text-ink">
                    Your Grounded Documents ({documents.length})
                  </h2>
                </div>
                <span className="rounded bg-moss-light px-2.5 py-1 font-mono text-[11px] text-moss">
                  SELECT * FROM user_documents WHERE user_id = auth.uid()
                </span>
              </div>

              {documents.length === 0 ? (
                <div className="mt-6 rounded-lg border border-dashed border-ink/15 p-10 text-center text-sm text-stone">
                  No grounded documents found for your account yet. Add your first record on the left.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {documents.map((doc) => (
                    <article
                      key={doc.id}
                      className="rounded-lg border border-ink/10 bg-paper p-5 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-ochre/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ochre">
                              {doc.classification}
                            </span>
                            <h3 className="font-display text-lg font-semibold text-ink">
                              {doc.title}
                            </h3>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-3">
                            {doc.content}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[11px] text-stone">
                            <span>Owner UUID: {doc.user_id}</span>
                            <span>
                              Created: {new Date(doc.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDelete(doc.id)}
                          aria-label="Delete document"
                          className="rounded-md border border-danger/25 p-2 text-danger transition hover:bg-danger/10"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Bookmarked Mining Opportunities */}
            <div className="rounded-xl border border-ink/10 bg-paper-2/50 p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-ink">
                  Saved Mining Opportunities ({savedProjects.length})
                </h2>
                <Link
                  to="/opportunities"
                  className="text-xs font-semibold text-ochre hover:underline"
                >
                  Browse All Streams →
                </Link>
              </div>

              {savedProjects.length === 0 ? (
                <p className="mt-3 text-sm text-stone">
                  You haven&apos;t bookmarked any mining licenses or tenders yet. Visit the{' '}
                  <Link to="/opportunities" className="text-ochre underline">
                    Opportunities Hub
                  </Link>{' '}
                  to save listings to your workspace.
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {savedProjects.map((proj) => (
                    <Link
                      key={proj.id}
                      to="/opportunities/$projectId"
                      params={{ projectId: proj.id }}
                      className="rounded-lg border border-ink/10 bg-paper p-4 transition hover:border-ochre"
                    >
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ochre">
                        {proj.commodity} · {proj.region}
                      </span>
                      <h3 className="mt-1 font-display text-base font-semibold text-ink">
                        {proj.title}
                      </h3>
                      <p className="mt-1 text-xs text-stone">
                        Ask: {proj.capitalAsk} · Stage: {proj.stage}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
