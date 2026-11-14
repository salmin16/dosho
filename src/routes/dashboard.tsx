import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import {
  Briefcase,
  Coins,
  Compass,
  FileText,
  Lock,
  LogOut,
  Pickaxe,
  PlusCircle,
  ShieldCheck,
  Trash2,
  Wrench,
} from 'lucide-react'
import {
  createGroundedDocument,
  deleteGroundedDocument,
  fetchGroundedUserData,
  getSession,
  signOutUser,
  useAuthSession,
} from '../lib/supabaseAuth'
import { useSavedProjects } from '../lib/saved'
import { PROJECTS } from '../data/fixtures'
import { useLocalization } from '../context/LocalizationContext'
import CurrencySwitcher from '../components/CurrencySwitcher'
import LanguageSwitcher from '../components/LanguageSwitcher'
import LiveMarketTicker from '../components/LiveMarketTicker'
import PriceDisplay from '../components/PriceDisplay'
import SubscriptionStatusWidget from '../components/SubscriptionStatusWidget'
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
  const session = useAuthSession()
  const { saved: savedProjectIds } = useSavedProjects()
  const {
    currency,
    language,
    currencyMeta,
    rateForSelected,
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

  const loadData = useCallback(async () => {
    const data = await fetchGroundedUserData()
    setProfile(data.profile)
    setDocuments(data.documents)
    setListedProjects(data.listedProjects)
    setQuoteRequests(data.quoteRequests)
    setUserOpportunities(data.userOpportunities)
    setUserServices(data.userServices)
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

  const handleSignOut = () => {
    signOutUser()
    navigate({ to: '/login' })
  }

  return (
    <div
      data-currency={currency}
      data-language={language}
      className="min-h-screen bg-paper pb-24 pt-28 text-ink"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        {/* Grounded Session Header */}
        <div className="flex flex-col justify-between gap-6 rounded-xl border border-ink/10 bg-ink p-6 text-paper sm:flex-row sm:items-center lg:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-moss/30 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-gold">
                <ShieldCheck size={14} />
                {ui('RLS Policy Active: auth.uid() = user_id · Role:', 'Sera ya RLS Inafanya Kazi: auth.uid() = user_id · Wajibu:', 'Política RLS Activa: auth.uid() = user_id · Rol:')}{' '}
                {session.user.role.toUpperCase()}
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
              {ui('Welcome,', 'Karibu,', 'Bienvenido,')}{' '}
              {profile?.full_name || session.user.fullName}
            </h1>
            <p className="mt-1 text-sm text-paper/75">
              {ui('Authenticated Email:', 'Barua Pepe Iliyothibitishwa:', 'Correo Autenticado:')}{' '}
              <span className="font-mono">{session.user.email}</span> ·{' '}
              {ui('User UUID:', 'Kitambulisho cha Mtumiaji:', 'UUID de Usuario:')}{' '}
              <span className="font-mono text-gold">{session.user.id}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
            <CurrencySwitcher dark />
            <LanguageSwitcher dark />
            {session.user.role === 'admin' && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-md border border-gold/50 bg-moss/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gold transition hover:bg-moss/40"
              >
                <ShieldCheck size={15} />
                {ui('Admin Console', 'Dashibodi ya Utawala', 'Consola Admin')}
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

        {/* Active Subscription Tier & Real-Time Quota Governance Widget */}
        <div className="mt-6">
          <SubscriptionStatusWidget
            projectsUsed={listedProjects.length}
            documentsUsed={documents.length}
            opportunitiesUsed={userOpportunities.length}
            servicesUsed={userServices.length}
          />
        </div>

        {/* Real-Time Market Status & Statutory Benchmark Ticker */}
        <div className="mt-6">
          <LiveMarketTicker compact showFullMarketsLink />
        </div>

        {/* Guided Publishing Module Quick-Access Banner */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            to="/dashboard/opportunities"
            className="group flex items-center justify-between gap-4 rounded-xl border border-ink/15 bg-ink p-5 text-paper shadow-md transition hover:border-gold/60 contours"
          >
            <div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-gold">
                <Compass size={13} />
                {ui(
                  '3-Step Guided Wizard · public.opportunities',
                  'Mfumo wa Hatua 3 · public.opportunities',
                  'Asistente de 3 Pasos · public.opportunities',
                )}
              </span>
              <h2 className="mt-1 font-display text-xl font-semibold text-paper group-hover:text-gold">
                {ui(
                  'Publish Mining Opportunity →',
                  'Chapisha Fursa ya Madini →',
                  'Publicar Oportunidad Minera →',
                )}
              </h2>
              <p className="mt-1 text-xs text-paper/70">
                {ui(
                  `Submit tenders, consultancies, exploration grants, JVs, or internships (${userOpportunities.length} submitted).`,
                  `Wasilisha zabuni, ushauri, ruzuku za utafutaji au mafunzo (${userOpportunities.length} zimewasilishwa).`,
                  `Envíe licitaciones, consultorías, subvenciones o pasantías (${userOpportunities.length} enviadas).`,
                )}
              </p>
            </div>
            <span className="shrink-0 rounded-lg border border-gold/40 bg-gold/15 px-3 py-2 font-mono text-xs font-semibold text-gold">
              /dashboard/opportunities
            </span>
          </Link>

          <Link
            to="/dashboard/services"
            className="group flex items-center justify-between gap-4 rounded-xl border border-ink/15 bg-ink p-5 text-paper shadow-md transition hover:border-gold/60 contours"
          >
            <div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-gold">
                <Wrench size={13} />
                {ui(
                  '3-Step Guided Wizard · public.services',
                  'Mfumo wa Hatua 3 · public.services',
                  'Asistente de 3 Pasos · public.services',
                )}
              </span>
              <h2 className="mt-1 font-display text-xl font-semibold text-paper group-hover:text-gold">
                {ui(
                  'Publish Technical Service →',
                  'Chapisha Huduma ya Kitaalamu →',
                  'Publicar Servicio Técnico →',
                )}
              </h2>
              <p className="mt-1 text-xs text-paper/70">
                {ui(
                  `Register accredited drilling, geological, assay, legal, or ESIA services (${userServices.length} submitted).`,
                  `Sajili huduma za uchorongaji, jiolojia, maabara, sheria au mazingira (${userServices.length} zimewasilishwa).`,
                  `Registre servicios acreditados de perforación, geología, laboratorio o legales (${userServices.length} enviados).`,
                )}
              </p>
            </div>
            <span className="shrink-0 rounded-lg border border-gold/40 bg-gold/15 px-3 py-2 font-mono text-xs font-semibold text-gold">
              /dashboard/services
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
              {ui('Records are strictly bound to', 'Rekodi zimefungwa moja kwa moja kwa', 'Los registros están vinculados a')}{' '}
              <code className="font-mono text-ink">
                user_id = {session.user.id.slice(0, 8)}…
              </code>
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
                  SELECT * FROM user_documents WHERE user_id = auth.uid()
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
                            <span>Owner UUID: {doc.user_id}</span>
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
