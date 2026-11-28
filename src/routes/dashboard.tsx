import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Briefcase,
  Compass,
  FileText,
  Lock,
  LogOut,
  Pickaxe,
  PlusCircle,
  Search,
  ShieldCheck,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import {
  createGroundedDocument,
  deleteGroundedDocument,
  fetchGroundedUserData,
  signOutUser,
  useAuthState,
} from '../lib/supabaseAuth'
import { useSavedProjects } from '../lib/saved'
import { PROJECTS } from '../data/fixtures'
import { useLocalization } from '../context/LocalizationContext'
import PriceDisplay from '../components/PriceDisplay'
import SubscriptionQuotaBar from '../components/SubscriptionQuotaBar'
import { DashboardWorkspaceSkeleton } from '../components/Skeletons'
import { normalizeVerificationLevel } from '../lib/verificationLevels'
import {
  formatOpportunityCategory,
  isOthersOpportunity,
} from '../lib/opportunityCategories'
import {
  DEFAULT_SERVICES_FILTER,
  SERVICE_FILTER_CATEGORIES,
  formatServiceCategory,
  matchesLiveServiceFilters,
  type ServiceCategorySelection,
} from '../lib/serviceCategories'
import { mergeRecordsById, mergeSingleRecord } from '../lib/mergeRecords'
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
  const [oppCategoryFilter, setOppCategoryFilter] = useState<string>('ALL')
  const [serviceCategoryFilter, setServiceCategoryFilter] =
    useState<ServiceCategorySelection>('ALL')
  const [serviceSearchQuery, setServiceSearchQuery] = useState<string>('')

  const filteredUserServices = useMemo(
    () =>
      userServices.filter((srv) =>
        matchesLiveServiceFilters(srv, {
          ...DEFAULT_SERVICES_FILTER,
          q: serviceSearchQuery,
          category: serviceCategoryFilter,
        }),
      ),
    [userServices, serviceSearchQuery, serviceCategoryFilter],
  )

  const [title, setTitle] = useState('')
  const [classification, setClassification] =
    useState<DocumentClassification>('CONFIDENTIAL')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [initialDataLoading, setInitialDataLoading] = useState(true)

  const currentUserId = session?.user.id ?? null
  const currentUserIdRef = useRef<string | null>(currentUserId)
  const loadedUserIdRef = useRef<string | null>(null)
  const hasLoadedOnceRef = useRef(false)

  useEffect(() => {
    currentUserIdRef.current = currentUserId
  }, [currentUserId])

  const loadData = useCallback(async () => {
    try {
      const data = await fetchGroundedUserData()
      setProfile((prev) => mergeSingleRecord(prev, data.profile))
      setDocuments((prev) => mergeRecordsById(prev, data.documents))
      setListedProjects((prev) => mergeRecordsById(prev, data.listedProjects))
      setQuoteRequests((prev) => mergeRecordsById(prev, data.quoteRequests))
      setUserOpportunities((prev) => mergeRecordsById(prev, data.userOpportunities))
      setUserServices((prev) => mergeRecordsById(prev, data.userServices))
      hasLoadedOnceRef.current = true
    } finally {
      setInitialDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!currentUserId) {
      loadedUserIdRef.current = null
      hasLoadedOnceRef.current = false
      navigate({ to: '/login' })
      return
    }
    if (loadedUserIdRef.current === currentUserId) {
      return
    }
    loadedUserIdRef.current = currentUserId
    void loadData()
  }, [authLoading, currentUserId, navigate, loadData])

  if ((authLoading && !hasLoadedOnceRef.current) || (currentUserId && initialDataLoading && !hasLoadedOnceRef.current && !profile)) {
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

  const currentVerifLevel = normalizeVerificationLevel(
    profile?.verification_level,
    profile?.verification_status,
  )

  return (
    <div
      data-currency={currency}
      data-language={language}
      className="min-h-[100dvh] overflow-x-hidden bg-paper pb-24 pt-24 text-ink sm:pt-28"
    >
      <div className="mx-auto w-full max-w-[1920px] px-4 sm:px-6 lg:px-8 xl:px-10">
        {/* Clean Workspace Welcome Header */}
        <div className="flex flex-col justify-between gap-5 rounded-xl border border-ink/10 bg-ink p-5 text-paper sm:flex-row sm:items-center sm:p-6 lg:p-8">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">
              {ui('Welcome,', 'Karibu,', 'Bienvenido,')}{' '}
              {profile?.full_name || session.user.fullName}
            </h1>
            <p className="mt-1 truncate text-sm text-paper/75">
              {session.user.email}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-md border border-gold/50 bg-moss/30 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-gold transition hover:bg-moss/40"
              >
                <ShieldCheck size={15} />
                {ui('Admin Dashboard', 'Dashibodi ya Utawala', 'Panel Admin')}
              </Link>
            )}
            <Link to="/list-a-project" className="btn-primary !min-h-[42px] !py-2 !px-4 text-xs">
              {ui('+ List a Project', '+ Sajili Mradi', '+ Publicar Proyecto')}
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-md border border-paper/20 bg-paper/10 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-paper transition hover:bg-paper/20"
            >
              <LogOut size={15} />
              {ui('Sign Out', 'Ondoka', 'Cerrar Sesión')}
            </button>
          </div>
        </div>

        {/* 12-Column Desktop Workspace Grid: Entitlements + Verification Status */}
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
          {/* Live Subscription & Quota Telemetry Strip */}
          <div className="min-w-0 lg:col-span-5 xl:col-span-4">
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

          {/* Concise Verification Status Card (Full L0–L4 framework & submission live on /verification) */}
          <section className="flex min-w-0 flex-col justify-between gap-3 rounded-xl border border-ink/12 bg-[#FCFBF8] p-4 sm:flex-row sm:items-center sm:p-5 lg:col-span-7 xl:col-span-8">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-semibold text-ink sm:text-lg">
                  {ui('Verification Status', 'Hali ya Uthibitisho', 'Estado de Verificación')}
                </h2>
                <span className="inline-flex items-center rounded-full border border-ink/15 bg-paper px-2.5 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wider text-ink tabular-nums">
                  {currentVerifLevel}
                </span>
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
              {profile?.verification_notes && (
                <p className="text-xs italic text-ink/75">
                  Reviewer Note: {profile.verification_notes}
                </p>
              )}
            </div>
            <Link
              to="/verification"
              className="inline-flex min-h-[40px] shrink-0 items-center self-start rounded-lg border border-ochre/30 bg-ochre/10 px-3.5 py-2 font-mono text-xs font-semibold text-ochre transition hover:border-ochre hover:bg-ochre hover:text-paper sm:min-h-[36px] sm:self-center"
            >
              {ui('View L0–L4 Framework →', 'Tazama Ngazi L0–L4 →', 'Ver Marco L0–L4 →')}
            </Link>
          </section>
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

        {/* Main Vault Grid (12-Column Desktop Split) */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Create Grounded Record */}
          <section className="min-w-0 rounded-xl border border-ink/10 bg-paper-2/70 p-6 lg:col-span-4">
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
          <section className="min-w-0 space-y-6 lg:col-span-8">
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

              {/* Scoped Opportunity Category Filter (includes "Others") */}
              {userOpportunities.length > 0 && (
                <div
                  role="group"
                  aria-label="Filter submitted opportunities by category"
                  className="mt-3 flex flex-wrap items-center gap-1.5"
                >
                  {(
                    [
                      ['ALL', 'All'],
                      ['Joint Venture', 'Joint Venture'],
                      ['Tender', 'Tender'],
                      ['Consultancy', 'Consultancy'],
                      ['Grant', 'Grant'],
                      ['Equipment Supply', 'Offtake / Supply'],
                      ['Internship', 'Internship'],
                      ['Others', 'Others'],
                    ] as const
                  ).map(([val, label]) => {
                    const active = oppCategoryFilter === val
                    return (
                      <button
                        key={val}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setOppCategoryFilter(val)}
                        className={`rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-semibold transition-colors ${
                          active
                            ? 'border-ink bg-ink text-paper'
                            : 'border-ink/15 bg-paper text-stone hover:border-ochre hover:text-ochre'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}

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
                  {userOpportunities
                    .filter((opp) => {
                      if (oppCategoryFilter === 'ALL') return true
                      if (oppCategoryFilter === 'Others') return isOthersOpportunity(opp)
                      return !isOthersOpportunity(opp) && opp.category === oppCategoryFilter
                    })
                    .map((opp) => (
                    <div
                      key={opp.id}
                      className="rounded-lg border border-ink/10 bg-paper p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-ochre">
                          OPPORTUNITY · {formatOpportunityCategory(opp)} · {opp.location} ({opp.reference_code})
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
                  {userServices.length > 0 && (
                    <div className="space-y-3 border-t border-ink/10 pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-stone tabular-nums">
                          {ui(
                            `Submitted Services (${filteredUserServices.length} of ${userServices.length})`,
                            `Huduma Ulizowasilisha (${filteredUserServices.length} kati ya ${userServices.length})`,
                            `Servicios Enviados (${filteredUserServices.length} de ${userServices.length})`,
                          )}
                        </span>
                        {(serviceCategoryFilter !== 'ALL' || serviceSearchQuery.trim()) && (
                          <button
                            type="button"
                            onClick={() => {
                              setServiceCategoryFilter('ALL')
                              setServiceSearchQuery('')
                            }}
                            className="font-mono text-[10.5px] font-semibold text-ochre hover:underline"
                          >
                            Clear filter
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                        <div className="relative sm:col-span-7">
                          <Search
                            size={14}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone"
                          />
                          <input
                            id="dashboard-services-search"
                            type="text"
                            aria-label="Search your submitted services"
                            value={serviceSearchQuery}
                            onChange={(e) => setServiceSearchQuery(e.target.value)}
                            placeholder="Search service title, discipline, certification, or region..."
                            className="min-h-[40px] w-full rounded-lg border border-ink/15 bg-paper pl-8 pr-8 text-base text-ink placeholder-stone/70 focus:border-ochre focus:bg-white focus:outline-none sm:text-sm"
                          />
                          {serviceSearchQuery && (
                            <button
                              type="button"
                              aria-label="Clear service search"
                              onClick={() => setServiceSearchQuery('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone hover:text-ink"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                        <div className="sm:col-span-5">
                          <label htmlFor="dashboard-services-category" className="sr-only">
                            Filter your services by category
                          </label>
                          <select
                            id="dashboard-services-category"
                            value={serviceCategoryFilter}
                            onChange={(e) =>
                              setServiceCategoryFilter(e.target.value as ServiceCategorySelection)
                            }
                            className="min-h-[40px] w-full rounded-lg border border-ink/15 bg-paper px-3 py-1.5 text-base text-ink focus:border-ochre focus:bg-white focus:outline-none sm:text-sm"
                          >
                            <option value="ALL">All Services</option>
                            {SERVICE_FILTER_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {filteredUserServices.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-ink/15 bg-paper px-4 py-5 text-center text-xs text-stone">
                          No submitted services match the selected category or search query.
                        </p>
                      ) : (
                        filteredUserServices.map((srv) => (
                          <div
                            key={srv.id}
                            className="rounded-lg border border-ink/10 bg-paper p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-[10px] uppercase tracking-wider text-ochre">
                                SERVICE · {formatServiceCategory(srv)} · {srv.regional_coverage} ({srv.reference_code})
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
                              <strong className="font-mono text-ochre tabular-nums">
                                <PriceDisplay amountInUSD={srv.estimated_rate_usd} />
                              </strong>
                              )
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
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
