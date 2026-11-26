import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import {
  Briefcase,
  Compass,
  FileText,
  Lock,
  LogOut,
  Pickaxe,
  PlusCircle,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Wrench,
} from 'lucide-react'
import {
  createGroundedDocument,
  deleteGroundedDocument,
  fetchGroundedUserData,
  signOutUser,
  submitUserVerificationRequest,
  useAuthState,
} from '../lib/supabaseAuth'
import { useSavedProjects } from '../lib/saved'
import { PROJECTS } from '../data/fixtures'
import { useLocalization } from '../context/LocalizationContext'
import PriceDisplay from '../components/PriceDisplay'
import SubscriptionQuotaBar from '../components/SubscriptionQuotaBar'
import SubscriptionStatusWidget from '../components/SubscriptionStatusWidget'
import { DashboardWorkspaceSkeleton } from '../components/Skeletons'
import VerificationBadge, {
  VerificationLimitsNotice,
} from '../components/VerificationBadge'
import { formatTanzaniaPhoneDisplay } from '../lib/phoneFormat'
import {
  normalizeVerificationLevel,
  VERIFICATION_LEVELS,
  VERIFICATION_LEVEL_LIST,
  type VerificationLevelCode,
} from '../lib/verificationLevels'
import {
  formatBytesCompact,
  validateAndCompressVerificationFile,
  type PreparedVerificationFile,
} from '../lib/verificationUpload'
import type {
  DocumentClassification,
  QuoteRequestRecord,
  UserDocument,
  UserListedProject,
  UserOpportunityRecord,
  UserProfile,
  UserServiceRecord,
} from '../types/database'

export const Route = createFileRoute('/dashboard')({
  component: DashboardRouteComponent,
})

export function DashboardRouteComponent() {
  const navigate = useNavigate()
  const { session, isAdmin, loading: authLoading } = useAuthState()
  const { saved: savedProjectIds } = useSavedProjects()
  const {
    currency,
    language,
    convertText,
    localizeProject,
    ui,
  } = useLocalization()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [documents, setDocuments] = useState<UserDocument[]>([])
  const [listedProjects, setListedProjects] = useState<UserListedProject[]>([])
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequestRecord[]>([])
  const [userOpportunities, setUserOpportunities] = useState<UserOpportunityRecord[]>([])
  const [userServices, setUserServices] = useState<UserServiceRecord[]>([])

  const [title, setTitle] = useState('')
  const [classification, setClassification] =
    useState<DocumentClassification>('CONFIDENTIAL')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Member Identity Verification Request State (`public.profiles` + `verification_submissions`)
  const [verifCompany, setVerifCompany] = useState('')
  const [verifPhone, setVerifPhone] = useState('')
  const [verifLicenceRef, setVerifLicenceRef] = useState('')
  const [verifRequestedLevel, setVerifRequestedLevel] =
    useState<Exclude<VerificationLevelCode, 'L0'>>('L1')
  const [verifNotes, setVerifNotes] = useState('')
  const [verifFile, setVerifFile] = useState<PreparedVerificationFile | null>(null)
  const [verifFileError, setVerifFileError] = useState<string | null>(null)
  const [verifCompressing, setVerifCompressing] = useState(false)
  const [verifMessage, setVerifMessage] = useState<string | null>(null)
  const [verifSubmitting, setVerifSubmitting] = useState(false)
  const [initialDataLoading, setInitialDataLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const data = await fetchGroundedUserData()
      setProfile(data.profile)
      if (data.profile?.company_name) setVerifCompany(data.profile.company_name)
      if (data.profile?.phone) setVerifPhone(formatTanzaniaPhoneDisplay(data.profile.phone))
      setDocuments(data.documents)
      setListedProjects(data.listedProjects)
      setQuoteRequests(data.quoteRequests)
      setUserOpportunities(data.userOpportunities)
      setUserServices(data.userServices)
    } finally {
      setInitialDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!session) {
      navigate({ to: '/login' })
      return
    }
    void loadData()
  }, [authLoading, session, navigate, loadData])

  if (authLoading || (session && initialDataLoading && !profile)) {
    return <DashboardWorkspaceSkeleton />
  }

  if (!session) {
    return null
  }

  const savedProjects = PROJECTS.filter((p) => savedProjectIds.includes(p.id)).map((p) =>
    localizeProject(p),
  )

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

  const handleSignOut = async () => {
    await signOutUser()
    navigate({ to: '/login' })
  }

  const handleVerificationFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    setVerifFileError(null)
    if (!file) {
      setVerifFile(null)
      return
    }
    setVerifCompressing(true)
    try {
      const result = await validateAndCompressVerificationFile(file)
      if (!result.ok) {
        setVerifFile(null)
        setVerifFileError(result.error)
      } else {
        setVerifFile(result.prepared)
      }
    } finally {
      setVerifCompressing(false)
    }
  }

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifMessage(null)
    setVerifSubmitting(true)
    try {
      const res = await submitUserVerificationRequest({
        companyName: verifCompany,
        phone: verifPhone,
        licenceReference: verifLicenceRef,
        requestedLevel: verifRequestedLevel,
        notes: verifNotes,
        preparedFile: verifFile,
      })
      if (res.error) {
        setVerifMessage(res.error)
      } else {
        setVerifMessage(
          res.warning ||
            `Verification request for ${verifRequestedLevel} (${VERIFICATION_LEVELS[verifRequestedLevel].title}) submitted! An administrator will review your profile shortly.`,
        )
        setVerifNotes('')
        setVerifFile(null)
        await loadData()
      }
    } finally {
      setVerifSubmitting(false)
    }
  }

  const currentVerifLevel = normalizeVerificationLevel(
    profile?.verification_level,
    profile?.verification_status,
  )
  const currentVerifSpec = VERIFICATION_LEVELS[currentVerifLevel]

  return (
    <div
      data-currency={currency}
      data-language={language}
      className="min-h-[100dvh] bg-paper pb-24 pt-28 text-ink"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        {/* Clean Workspace Welcome Header */}
        <div className="flex flex-col justify-between gap-6 rounded-xl border border-ink/10 bg-ink p-6 text-paper sm:flex-row sm:items-center lg:p-8">
          <div>
            <h1 className="font-display text-3xl font-semibold">
              {ui('Welcome,', 'Karibu,', 'Bienvenido,')}{' '}
              {profile?.full_name || session.user.fullName}
            </h1>
            <p className="mt-1 text-sm text-paper/75">
              {session.user.email}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-md border border-gold/50 bg-moss/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gold transition hover:bg-moss/40"
              >
                <ShieldCheck size={15} />
                {ui('Admin Dashboard', 'Dashibodi ya Utawala', 'Panel Admin')}
              </Link>
            )}
            <Link to="/list-a-project" className="btn-primary !py-2.5 !px-4 text-xs">
              {ui('+ List a Project', '+ Sajili Mradi', '+ Publicar Proyecto')}
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 rounded-md border border-paper/20 bg-paper/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-paper transition hover:bg-paper/20"
            >
              <LogOut size={15} />
              {ui('Sign Out', 'Ondoka', 'Cerrar Sesión')}
            </button>
          </div>
        </div>

        {/* Live Subscription & Quota Telemetry Strip */}
        <div className="mt-5">
          <SubscriptionQuotaBar
            contextLabel={ui('Workspace Entitlements', 'Haki za Dashibodi', 'Permisos del Panel')}
            projectsUsed={listedProjects.length}
            quotesUsedThisMonth={
              quoteRequests.filter((q) => {
                const d = new Date(q.created_at)
                const now = new Date()
                return (
                  d.getUTCFullYear() === now.getUTCFullYear() &&
                  d.getUTCMonth() === now.getUTCMonth()
                )
              }).length
            }
          />
        </div>

        {/* Member Identity Verification Status & 5-Tier (L0–L4) Fast Pipeline Panel */}
        <section className="mt-6 space-y-4 rounded-xl border border-ink/12 bg-[#FCFBF8] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-semibold text-ink">
                  5-Tier Account &amp; Tenement Verification (L0–L4)
                </h2>
                <VerificationBadge level={currentVerifLevel} size="sm" showQuota />
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                    profile?.verification_status === 'verified'
                      ? 'border-moss/40 bg-moss-light text-moss'
                      : profile?.verification_status === 'pending'
                        ? 'border-gold/50 bg-gold/20 text-ochre'
                        : profile?.verification_status === 'rejected'
                          ? 'border-danger/40 bg-danger/15 text-danger'
                          : 'border-ink/15 bg-paper text-stone'
                  }`}
                >
                  <ShieldCheck size={11} className="shrink-0" />
                  {profile?.verification_status || 'unverified'}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone">
                Current tier: <strong className="text-ink">{currentVerifSpec.code} · {currentVerifSpec.title}</strong>{' '}
                (Pilot listing quota: <strong className="font-mono tabular-nums">{currentVerifSpec.pilotListingQuota}</strong> — decoupled from your subscription plan).
              </p>
              {profile?.verification_notes && (
                <p className="mt-1 text-xs italic text-ink/75">
                  Reviewer Note: {profile.verification_notes}
                </p>
              )}
            </div>
            <Link to="/verification" className="inline-flex min-h-[44px] sm:min-h-[32px] items-center font-mono text-[11px] font-semibold text-ochre hover:underline shrink-0">
              View L0–L4 Framework →
            </Link>
          </div>

          <VerificationLimitsNotice level={currentVerifLevel} compact />

          {currentVerifLevel !== 'L4' && (
            <form onSubmit={handleSubmitVerification} className="space-y-4 border-t border-ink/10 pt-4">
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label htmlFor="verif-company" className="label">
                    Company / Organization
                  </label>
                  <input
                    id="verif-company"
                    type="text"
                    required
                    autoComplete="organization"
                    value={verifCompany}
                    onChange={(e) => setVerifCompany(e.target.value)}
                    placeholder="e.g. Geita Goldfields Ltd"
                    className="field"
                  />
                </div>
                <div>
                  <label htmlFor="verif-phone" className="label">
                    Phone Number
                  </label>
                  <input
                    id="verif-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={verifPhone}
                    onChange={(e) => setVerifPhone(e.target.value)}
                    onBlur={() => setVerifPhone((prev) => formatTanzaniaPhoneDisplay(prev))}
                    placeholder="0712 345 678 or +255 712 345 678"
                    className="field font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="verif-level" className="label">
                    Target Verification Level
                  </label>
                  <select
                    id="verif-level"
                    value={verifRequestedLevel}
                    onChange={(e) =>
                      setVerifRequestedLevel(
                        e.target.value as Exclude<VerificationLevelCode, 'L0'>,
                      )
                    }
                    className="field"
                  >
                    {VERIFICATION_LEVEL_LIST.filter((v) => v.code !== 'L0').map((v) => (
                      <option key={v.code} value={v.code}>
                        {v.code} · {v.title} (Pilot cap: {v.pilotListingQuota})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="verif-licence-ref" className="label">
                    BRELA / Licence Ref
                  </label>
                  <input
                    id="verif-licence-ref"
                    type="text"
                    value={verifLicenceRef}
                    onChange={(e) => setVerifLicenceRef(e.target.value)}
                    placeholder="e.g. PML-2026-00412"
                    className="field font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div>
                  <label htmlFor="verif-notes" className="label">
                    Reviewer Notes (Optional)
                  </label>
                  <input
                    id="verif-notes"
                    type="text"
                    value={verifNotes}
                    onChange={(e) => setVerifNotes(e.target.value)}
                    placeholder="e.g. Attached BRELA & PML certificate"
                    className="field"
                  />
                </div>
                <div>
                  <span className="label">Supporting Document (PDF / Image)</span>
                  <label
                    htmlFor="verif-file-upload"
                    className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-dashed border-ink/25 bg-paper/75 px-3 py-2 text-xs text-stone transition-colors hover:border-ochre hover:text-ink"
                  >
                    <UploadCloud size={15} className="shrink-0 text-ochre" />
                    <span className="truncate font-mono text-[11px]">
                      {verifCompressing
                        ? 'Compressing file...'
                        : verifFile
                          ? `${verifFile.fileName} (${formatBytesCompact(verifFile.compressedBytes)}${verifFile.wasCompressed ? ' compressed' : ''})`
                          : 'Choose PDF, JPG, PNG, or WebP'}
                    </span>
                    <input
                      id="verif-file-upload"
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      onChange={(e) => void handleVerificationFileChange(e)}
                      className="sr-only"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={verifSubmitting || verifCompressing}
                  className="btn-primary !min-h-[44px] text-xs disabled:opacity-50"
                >
                  {verifSubmitting
                    ? 'Submitting...'
                    : profile?.verification_status === 'pending'
                      ? `Update ${verifRequestedLevel} Request`
                      : `Request ${verifRequestedLevel}`}
                </button>
              </div>
              {verifFileError && (
                <p role="alert" className="rounded border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger">
                  {verifFileError}
                </p>
              )}
            </form>
          )}

          {verifMessage && (
            <p role="status" className="rounded border border-moss/30 bg-moss-light px-3 py-2 text-xs font-medium text-moss">
              {verifMessage}
            </p>
          )}
        </section>

        {/* Active Subscription Tier & Real-Time Quota Governance Widget */}
        <div className="mt-6">
          <SubscriptionStatusWidget
            projectsUsed={listedProjects.length}
            quotesUsedThisMonth={
              quoteRequests.filter((q) => {
                const d = new Date(q.created_at)
                const now = new Date()
                return (
                  d.getUTCFullYear() === now.getUTCFullYear() &&
                  d.getUTCMonth() === now.getUTCMonth()
                )
              }).length
            }
            documentsUsed={documents.length}
            opportunitiesUsed={userOpportunities.length}
            servicesUsed={userServices.length}
          />
        </div>

        {/* Guided Publishing Module Quick-Access Banner */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            to="/dashboard/opportunities"
            className="group flex min-w-0 max-w-full flex-col items-start justify-between gap-4 overflow-hidden rounded-xl border border-ink/15 bg-ink p-5 text-paper shadow-md transition hover:border-gold/60 sm:flex-row sm:items-center sm:p-6 md:flex-col md:items-start xl:flex-row xl:items-center contours"
          >
            <div className="w-full min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-wider text-gold">
                <Compass size={13} className="shrink-0" />
                {ui(
                  '3-Step Guided Wizard',
                  'Mfumo wa Hatua 3',
                  'Asistente de 3 Pasos',
                )}
              </span>
              <h2 className="mt-1.5 font-display text-xl font-semibold leading-snug text-paper transition group-hover:text-gold sm:text-2xl">
                {ui(
                  'Publish Mining Opportunity →',
                  'Chapisha Fursa ya Madini →',
                  'Publicar Oportunidad Minera →',
                )}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-paper/75 sm:text-xs">
                {ui(
                  `Submit tenders, consultancies, exploration grants, JVs, or internships (${userOpportunities.length} submitted).`,
                  `Wasilisha zabuni, ushauri, ruzuku za utafutaji au mafunzo (${userOpportunities.length} zimewasilishwa).`,
                  `Envíe licitaciones, consultorías, subvenciones o pasantías (${userOpportunities.length} enviadas).`,
                )}
              </p>
            </div>
            <span className="inline-flex w-full shrink-0 items-center justify-between gap-2 rounded-lg border border-gold/40 bg-gold/15 px-3.5 py-2.5 font-mono text-xs font-semibold text-gold transition group-hover:bg-gold/25 sm:w-auto sm:justify-center sm:py-2 md:w-full md:justify-between xl:w-auto xl:justify-center">
              <span className="truncate">/dashboard/opportunities</span>
              <span className="sm:hidden md:inline xl:hidden" aria-hidden="true">→</span>
            </span>
          </Link>

          <Link
            to="/dashboard/services"
            className="group flex min-w-0 max-w-full flex-col items-start justify-between gap-4 overflow-hidden rounded-xl border border-ink/15 bg-ink p-5 text-paper shadow-md transition hover:border-gold/60 sm:flex-row sm:items-center sm:p-6 md:flex-col md:items-start xl:flex-row xl:items-center contours"
          >
            <div className="w-full min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] font-semibold uppercase tracking-wider text-gold">
                <Wrench size={13} className="shrink-0" />
                {ui(
                  '3-Step Guided Wizard',
                  'Mfumo wa Hatua 3',
                  'Asistente de 3 Pasos',
                )}
              </span>
              <h2 className="mt-1.5 font-display text-xl font-semibold leading-snug text-paper transition group-hover:text-gold sm:text-2xl">
                {ui(
                  'Publish Technical Service →',
                  'Chapisha Huduma ya Kitaalamu →',
                  'Publicar Servicio Técnico →',
                )}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-paper/75 sm:text-xs">
                {ui(
                  `Register accredited drilling, geological, assay, legal, or ESIA services (${userServices.length} submitted).`,
                  `Sajili huduma za uchorongaji, jiolojia, maabara, sheria au mazingira (${userServices.length} zimewasilishwa).`,
                  `Registre servicios acreditados de perforación, geología, laboratorio o legales (${userServices.length} enviados).`,
                )}
              </p>
            </div>
            <span className="inline-flex w-full shrink-0 items-center justify-between gap-2 rounded-lg border border-gold/40 bg-gold/15 px-3.5 py-2.5 font-mono text-xs font-semibold text-gold transition group-hover:bg-gold/25 sm:w-auto sm:justify-center sm:py-2 md:w-full md:justify-between xl:w-auto xl:justify-center">
              <span className="truncate">/dashboard/services</span>
              <span className="sm:hidden md:inline xl:hidden" aria-hidden="true">→</span>
            </span>
          </Link>
        </div>

        {/* Main Vault Grid */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Create Grounded Record */}
          <section className="rounded-xl border border-ink/10 bg-paper-2/70 p-6">
            <div className="flex items-center gap-2 text-ochre">
              <PlusCircle size={18} />
              <h2 className="font-display text-xl font-semibold text-ink">
                {ui('New Grounded Record', 'Rekodi Mpya ya Hifadhi', 'Nuevo Registro en Bóveda')}
              </h2>
            </div>
            <p className="mt-1 text-xs text-stone">
              {ui(
                'Private due-diligence notes accessible only to your account.',
                'Maelezo binafsi ya uhakiki yanayoweza kuonekana na akaunti yako pekee.',
                'Notas privadas de debida diligencia visibles solo para su cuenta.',
              )}
            </p>

            {error && (
              <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div>
                <label htmlFor="doc-title" className="label">
                  {ui('Document / Dossier Title', 'Kichwa cha Hati / Jalada', 'Título del Documento')}
                </label>
                <input
                  id="doc-title"
                  type="text"
                  required
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={ui(
                    'e.g., Kahama Drill Core Assay Verification',
                    'mf., Uthibitisho wa Sampuli za Uchorongaji Kahama',
                    'ej., Verificación de Muestras de Perforación Kahama',
                  )}
                  className="field"
                />
              </div>

              <div>
                <label htmlFor="doc-class" className="label">
                  {ui('Security Classification', 'Daraja la Usalama', 'Clasificación de Seguridad')}
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
                  {ui(
                    'Grounded Notes & Due-Diligence Payload',
                    'Maelezo ya Kina na Uhakiki (Due Diligence)',
                    'Notas y Datos de Debida Diligencia',
                  )}
                </label>
                <textarea
                  id="doc-content"
                  rows={4}
                  required
                  maxLength={10000}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={ui(
                    'Enter private geological findings, license numbers, or term-sheet notes...',
                    'Ingiza taarifa za jiolojia, namba za leseni au maelezo ya mkataba...',
                    'Ingrese hallazgos geológicos privados, números de licencia o notas...',
                  )}
                  className="field"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full disabled:opacity-50"
              >
                <Lock size={15} />
                {saving
                  ? ui('Encrypting & Saving...', 'Inahifadhi kwa Usalama...', 'Cifrando y Guardando...')
                  : ui('Save to Grounded Vault', 'Hifadhi kwenye Vault', 'Guardar en Bóveda')}
              </button>
            </form>
          </section>

          {/* Grounded Documents, Listed Projects & Quote Requests */}
          <section className="space-y-6 lg:col-span-2">
            {/* Grounded Documents List */}
            <div className="rounded-xl border border-ink/10 bg-paper-2/50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-ochre" />
                  <h2 className="font-display text-xl font-semibold text-ink">
                    {ui(
                      `Your Grounded Documents (${documents.length})`,
                      `Hati Zako Zilizohifadhiwa (${documents.length})`,
                      `Sus Documentos en Bóveda (${documents.length})`,
                    )}
                  </h2>
                </div>
                <span className="rounded bg-moss-light px-2.5 py-1 font-mono text-[11px] text-moss">
                  {ui('Private Workspace', 'Hifadhi Binafsi', 'Espacio Privado')}
                </span>
              </div>

              {documents.length === 0 ? (
                <div className="mt-6 rounded-lg border border-dashed border-ink/15 p-10 text-center text-sm text-stone">
                  {ui(
                    'No grounded documents found for your account yet. Add your first record on the left.',
                    'Hakuna hati zilizohifadhiwa bado. Ongeza rekodi yako ya kwanza upande wa kushoto.',
                    'Aún no hay documentos en su cuenta. Agregue su primer registro a la izquierda.',
                  )}
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
                              {convertText(doc.title)}
                            </h3>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-ink-3">
                            {convertText(doc.content)}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[11px] text-stone">
                            <span>
                              {ui('Created:', 'Imeundwa:', 'Creado:')}{' '}
                              {new Date(doc.created_at).toLocaleString()}
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

            {/* Guided Opportunities & Services */}
            <div className="rounded-xl border border-ink/10 bg-paper-2/50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Compass size={18} className="text-ochre" />
                  <h2 className="font-display text-xl font-semibold text-ink">
                    {ui(
                      `Your Guided Opportunities & Services (${userOpportunities.length + userServices.length})`,
                      `Fursa na Huduma Ulizowasilisha (${userOpportunities.length + userServices.length})`,
                      `Sus Oportunidades y Servicios (${userOpportunities.length + userServices.length})`,
                    )}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    to="/dashboard/opportunities"
                    className="text-xs font-semibold text-ochre hover:underline"
                  >
                    {ui('+ New Opportunity →', '+ Fursa Mpya →', '+ Nueva Oportunidad →')}
                  </Link>
                  <Link
                    to="/dashboard/services"
                    className="text-xs font-semibold text-ochre hover:underline"
                  >
                    {ui('+ New Service →', '+ Huduma Mpya →', '+ Nuevo Servicio →')}
                  </Link>
                </div>
              </div>

              {userOpportunities.length === 0 && userServices.length === 0 ? (
                <p className="mt-3 text-sm text-stone">
                  {ui(
                    'No opportunities or technical services published yet. Launch the ',
                    'Bado hujachapisha fursa au huduma za kitaalamu. Fungua ',
                    'Aún no se han publicado oportunidades o servicios. Inicie el ',
                  )}
                  <Link to="/dashboard/opportunities" className="text-ochre underline">
                    {ui('Opportunity Wizard', 'Mfumo wa Fursa', 'Asistente de Oportunidades')}
                  </Link>{' '}
                  {ui('or', 'au', 'o')}{' '}
                  <Link to="/dashboard/services" className="text-ochre underline">
                    {ui('Service Wizard', 'Mfumo wa Huduma', 'Asistente de Servicios')}
                  </Link>
                  .
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {userOpportunities.map((opp) => (
                    <div
                      key={opp.id}
                      className="rounded-lg border border-ink/10 bg-paper p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-ochre">
                          OPPORTUNITY · {opp.category} · {opp.location} ({opp.reference_code})
                        </span>
                        <span className="rounded bg-gold/20 px-2 py-0.5 font-mono text-[10px] uppercase text-ink">
                          {opp.status}
                        </span>
                      </div>
                      <h3 className="mt-1 font-display text-base font-semibold text-ink">
                        {convertText(opp.title)}
                      </h3>
                      <p className="mt-1 text-xs text-stone">
                        {opp.organization} · {ui('Deadline:', 'Mwisho:', 'Fecha límite:')} {opp.deadline} ·{' '}
                        {ui('Budget', 'Bajeti', 'Presupuesto')} ({currency}):{' '}
                        <strong className="font-mono text-ochre">
                          {opp.compensation_usd > 0 ? (
                            <PriceDisplay amountInUSD={opp.compensation_usd} />
                          ) : (
                            ui('Per Tender Schedule', 'Kulingana na Zabuni', 'Según Licitación')
                          )}
                        </strong>
                      </p>
                    </div>
                  ))}
                  {userServices.map((srv) => (
                    <div
                      key={srv.id}
                      className="rounded-lg border border-ink/10 bg-paper p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-ochre">
                          SERVICE · {srv.expertise_area} · {srv.regional_coverage} ({srv.reference_code})
                        </span>
                        <span className="rounded bg-gold/20 px-2 py-0.5 font-mono text-[10px] uppercase text-ink">
                          {srv.status}
                        </span>
                      </div>
                      <h3 className="mt-1 font-display text-base font-semibold text-ink">
                        {convertText(srv.service_name)}
                      </h3>
                      <p className="mt-1 text-xs text-stone">
                        {srv.provider_organization} · {ui('Rate', 'Gharama', 'Tarifa')} ({currency}):{' '}
                        {convertText(srv.rate_or_pricing_model)} (
                        <strong className="font-mono text-ochre">
                          <PriceDisplay amountInUSD={srv.estimated_rate_usd} />
                        </strong>
                        )
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Grounded Listed Projects */}
            <div className="rounded-xl border border-ink/10 bg-paper-2/50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Pickaxe size={18} className="text-ochre" />
                  <h2 className="font-display text-xl font-semibold text-ink">
                    {ui(
                      `Your Submitted Projects (${listedProjects.length})`,
                      `Miradi Yako Iliyowasilishwa (${listedProjects.length})`,
                      `Sus Proyectos Enviados (${listedProjects.length})`,
                    )}
                  </h2>
                </div>
                <Link
                  to="/list-a-project"
                  className="text-xs font-semibold text-ochre hover:underline"
                >
                  {ui('+ List Another Project →', '+ Sajili Mradi Mwingine →', '+ Publicar Otro Proyecto →')}
                </Link>
              </div>

              {listedProjects.length === 0 ? (
                <p className="mt-3 text-sm text-stone">
                  {ui(
                    "You haven't submitted any projects yet. Use the ",
                    'Bado hujawasilisha mradi wowote. Tumia ukurasa wa ',
                    'Aún no ha enviado proyectos. Utilice el flujo de ',
                  )}
                  <Link to="/list-a-project" className="text-ochre underline">
                    {ui('List a Project', 'Sajili Mradi', 'Publicar un Proyecto')}
                  </Link>
                  .
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {listedProjects.map((proj) => (
                    <div
                      key={proj.id}
                      className="rounded-lg border border-ink/10 bg-paper p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-ochre">
                          {proj.mineral} · {proj.region} · {proj.licence_type} ({proj.licence_reference})
                        </span>
                        <span className="rounded bg-moss-light px-2 py-0.5 font-mono text-[10px] text-moss">
                          {proj.status}
                        </span>
                      </div>
                      <h3 className="mt-1 font-display text-lg font-semibold text-ink">
                        {convertText(proj.title)}
                      </h3>
                      <p className="mt-1 text-xs text-stone">{convertText(proj.summary)}</p>
                      <p className="mt-2 font-mono text-xs font-semibold text-ink">
                        {ui('Seeking Investment', 'Uwekezaji Unaohitajika', 'Inversión Solicitada')} ({currency}):{' '}
                        <span className="text-ochre">
                          <PriceDisplay amountInUSD={proj.investment_usd} />
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Grounded Quote Requests */}
            <div className="rounded-xl border border-ink/10 bg-paper-2/50 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Briefcase size={18} className="text-ochre" />
                  <h2 className="font-display text-xl font-semibold text-ink">
                    {ui(
                      `Your Service Quote Requests (${quoteRequests.length})`,
                      `Maombi Yako ya Bei za Huduma (${quoteRequests.length})`,
                      `Sus Solicitudes de Cotización (${quoteRequests.length})`,
                    )}
                  </h2>
                </div>
                <Link
                  to="/services"
                  className="text-xs font-semibold text-ochre hover:underline"
                >
                  {ui('Request Another Quote →', 'Omba Bei Nyingine →', 'Solicitar Otra Cotización →')}
                </Link>
              </div>

              {quoteRequests.length === 0 ? (
                <p className="mt-3 text-sm text-stone">
                  {ui(
                    'No service quotes requested yet. Visit the ',
                    'Bado hujaomba bei ya huduma. Tembelea ',
                    'Aún no ha solicitado cotizaciones. Visite el ',
                  )}
                  <Link to="/services" className="text-ochre underline">
                    {ui('Mining Services Marketplace', 'Soko la Huduma za Madini', 'Mercado de Servicios Mineros')}
                  </Link>{' '}
                  ({currency}).
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {quoteRequests.map((q) => (
                    <div
                      key={q.id}
                      className="rounded-lg border border-ink/10 bg-paper p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-ochre">
                          {ui('Provider:', 'Mtoa Huduma:', 'Proveedor:')} {q.provider_name}
                        </span>
                        <span className="rounded bg-gold/20 px-2 py-0.5 font-mono text-[10px] text-ink">
                          {q.status}
                        </span>
                      </div>
                      <h3 className="mt-1 font-display text-base font-semibold text-ink">
                        {convertText(q.service_requested)}
                      </h3>
                      <p className="mt-1 text-xs text-stone">{convertText(q.scope_notes)}</p>
                      <p className="mt-2 font-mono text-xs font-semibold text-ink">
                        {ui('Estimated Budget', 'Makadirio ya Bajeti', 'Presupuesto Estimado')} ({currency}):{' '}
                        <span className="text-ochre">
                          <PriceDisplay amountInUSD={q.estimated_budget_usd} />
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bookmarked Mining Opportunities */}
            <div className="rounded-xl border border-ink/10 bg-paper-2/50 p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-ink">
                  {ui(
                    `Saved Mining Opportunities (${savedProjects.length})`,
                    `Fursa za Madini Ulizohifadhi (${savedProjects.length})`,
                    `Oportunidades Mineras Guardadas (${savedProjects.length})`,
                  )}
                </h2>
                <Link
                  to="/opportunities"
                  className="text-xs font-semibold text-ochre hover:underline"
                >
                  {ui('Browse All Streams →', 'Tazama Fursa Zote →', 'Explorar Oportunidades →')}
                </Link>
              </div>

              {savedProjects.length === 0 ? (
                <p className="mt-3 text-sm text-stone">
                  {ui(
                    "You haven't bookmarked any mining licenses or tenders yet. Visit the ",
                    'Bado hujahifadhi leseni au zabuni yoyote. Tembelea ',
                    'Aún no ha guardado licencias o licitaciones. Visite el ',
                  )}
                  <Link to="/opportunities" className="text-ochre underline">
                    {ui('Opportunities Hub', 'Kituo cha Fursa', 'Centro de Oportunidades')}
                  </Link>
                  .
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
                        {proj.minerals.join(', ')} · {proj.region}
                      </span>
                      <h3 className="mt-1 font-display text-base font-semibold text-ink">
                        {proj.title}
                      </h3>
                      <p className="mt-1 text-xs text-stone">
                        {ui('Seeking', 'Inahitaji', 'Buscando')} ({currency}):{' '}
                        <strong className="text-ink">
                          <PriceDisplay amountInUSD={proj.investmentUsd} compact />
                        </strong>{' '}
                        · {ui('Stage:', 'Hatua:', 'Etapa:')} {proj.stage}
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
