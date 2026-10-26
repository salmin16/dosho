import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Check,
  CircleSlash,
  FileText,
  Flag,
  Lock,
  MapPin,
  MessageSquareText,
  Microscope,
  Route as RouteIcon,
  ShieldCheck,
  Unlock,
  Droplets,
  Zap,
  X,
  CheckCircle2,
} from 'lucide-react'
import { PROJECTS, formatUsd, getProject, type Project } from '../data/fixtures'
import { img } from '../lib/img'
import { useSavedProjects } from '../lib/saved'
import { useI18n } from '../i18n'
import VerificationBadge, { levelTone } from '../components/VerificationBadge'
import ProjectCard from '../components/ProjectCard'
import TanzaniaMap from '../components/TanzaniaMap'

export const Route = createFileRoute('/opportunities_/$projectId')({
  loader: ({ params }) => {
    const project = getProject(params.projectId)
    if (!project) throw notFound()
    return { project }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.project.title} — MineConnect` : 'Project — MineConnect' },
      { name: 'description', content: loaderData?.project.summary ?? '' },
    ],
  }),
  notFoundComponent: NotFoundProject,
  component: ProjectDetail,
})

function NotFoundProject() {
  const { t } = useI18n()
  return (
    <div className="mx-auto max-w-xl px-5 pb-32 pt-48 text-center">
      <h1 className="font-display text-5xl font-light">{t('detail.notFoundTitle')}</h1>
      <p className="mt-4 text-stone">{t('detail.notFoundBody')}</p>
      <Link to="/opportunities" className="btn-primary mt-8">
        {t('detail.browseOpportunities')}
      </Link>
    </div>
  )
}

type Modal = null | 'enquiry' | 'diligence' | 'report'

function ProjectDetail() {
  const { project: rawProject } = Route.useLoaderData()
  const { t, tv, localizeProject, formatDate, fixtures } = useI18n()
  const p = localizeProject(rawProject)
  const { isSaved, toggle } = useSavedProjects()
  const [modal, setModal] = useState<Modal>(null)
  const saved = isSaved(p.id)
  const levelMeta = fixtures.verificationLevels[p.verification.level]
  const related = PROJECTS.filter(
    (x) => x.id !== p.id && (x.minerals.some((m) => p.minerals.includes(m)) || x.region === p.region),
  ).slice(0, 3)

  return (
    <div className="pt-[72px]">
      {/* Banner */}
      <section className="grain relative isolate overflow-hidden bg-ink text-paper">
        <img src={img(p.image, 1600)} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/85 to-ink/30" />
        <div className="mx-auto max-w-7xl px-5 pb-14 pt-10 lg:px-8">
          <Link to="/opportunities" className="inline-flex items-center gap-1.5 text-sm text-paper/60 hover:text-paper">
            <ArrowLeft size={15} /> {t('detail.allOpportunities')}
          </Link>
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs tracking-[0.14em] text-paper/50">{p.id}</span>
            <span className="text-paper/30">·</span>
            {p.minerals.map((m) => (
              <span key={m} className="rounded-full bg-gold px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink">
                {tv(m)}
              </span>
            ))}
            <VerificationBadge level={p.verification.level} size="md" />
          </div>
          <h1 className="font-display mt-5 max-w-4xl text-4xl font-light leading-[1.02] md:text-6xl">{p.title}</h1>
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm text-paper/75">
            <span className="flex items-center gap-1.5">
              <MapPin size={15} className="text-gold" /> {p.district}, {t('detail.regionSuffix', { region: p.region })}
            </span>
            <span>{tv(p.type)}</span>
            <span>{tv(p.stage)}</span>
            <span>{t('detail.updatedOn', { date: formatDate(p.updatedOn) })}</span>
          </div>
          <div className="mt-8 inline-flex max-w-3xl items-start gap-3 rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-paper/90">
            <RouteIcon size={16} className="mt-0.5 shrink-0 text-gold" />
            <span>
              <strong className="font-semibold">{t('detail.transactionStatus')}</strong> {p.transactionStatus}
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="min-w-0 space-y-14">
          <Section title={t('detail.projectSummary')}>
            <p className="text-lg leading-relaxed text-ink/85">{p.summary}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {p.highlights.map((h) => (
                <li key={h} className="flex gap-2.5 rounded-lg border border-ink/10 bg-white/50 p-4 text-sm">
                  <Check size={16} className="mt-0.5 shrink-0 text-moss" /> {h}
                </li>
              ))}
            </ul>
          </Section>

          <Section title={t('detail.licenceInfo')}>
            <dl className="grid overflow-hidden rounded-xl border border-ink/10 sm:grid-cols-3">
              {[
                [t('detail.rightType'), tv(p.licence.type), false],
                [t('detail.reference'), p.licence.reference, true],
                [t('detail.status'), tv(p.licence.status), false],
                [t('detail.issued'), formatDate(p.licence.issued), false],
                [t('detail.expires'), formatDate(p.licence.expires), false],
                [t('detail.area'), `${p.areaHa.toLocaleString()} ha`, false],
              ].map(([k, v, isMono]) => (
                <div key={String(k)} className="border-b border-r border-ink/10 bg-white/50 p-5 [&:nth-child(3n)]:border-r-0">
                  <dt className="label !mb-1">{k}</dt>
                  <dd className={`font-medium ${isMono ? 'font-mono text-sm' : ''}`}>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-stone">{t('detail.licenceNote')}</p>
          </Section>

          <Section title={t('detail.technicalEvidence')}>
            <div className="grid gap-3 sm:grid-cols-2">
              {p.evidence.map((e) => (
                <div key={e.label} className="flex gap-4 rounded-xl border border-ink/10 bg-white/50 p-5">
                  <Microscope size={20} className="shrink-0 text-ochre" />
                  <div>
                    <div className="label !mb-1">{e.label}</div>
                    <p className="text-sm">{e.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title={t('detail.infrastructure')}>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                [RouteIcon, t('detail.access'), p.infrastructure.access],
                [Zap, t('detail.power'), p.infrastructure.power],
                [Droplets, t('detail.water'), p.infrastructure.water],
              ].map(([Icon, k, v]) => {
                const I = Icon as typeof Zap
                return (
                  <div key={k as string} className="rounded-xl border border-ink/10 bg-white/50 p-5">
                    <I size={18} className="text-ochre" />
                    <div className="label mt-4 !mb-1">{k as string}</div>
                    <p className="text-sm">{v as string}</p>
                  </div>
                )
              })}
            </div>
          </Section>

          <Section title={t('detail.location')}>
            <div className="grid items-center gap-6 rounded-xl border border-ink/10 bg-white/50 p-5 sm:grid-cols-[1fr_1.1fr]">
              <TanzaniaMap projects={[p]} selectedId={p.id} className="w-full" />
              <div className="text-sm">
                <p className="font-display text-2xl">
                  {p.district}, {p.region}
                </p>
                <p className="mt-2 text-stone">
                  {t('detail.locationDisclosurePre')}{' '}
                  <strong className="text-ink">{tv(p.locationDisclosure)}</strong>. {t('detail.locationDisclosurePost')}
                </p>
              </div>
            </div>
          </Section>

          <Section title={t('detail.documents')}>
            <ul className="divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10 bg-white/50">
              {p.documents.map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-4 p-4">
                  <span className="flex items-center gap-3">
                    <FileText size={18} className="shrink-0 text-stone" />
                    <span>
                      <span className="block text-sm font-medium">{d.name}</span>
                      <span className="font-mono text-[11px] text-stone">{d.kind}</span>
                    </span>
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${
                      d.access === 'Public' ? 'bg-moss-light text-moss' : d.access === 'On request' ? 'bg-paper-2 text-stone' : 'bg-ink text-paper'
                    }`}
                  >
                    {d.access === 'Public' ? <Unlock size={11} /> : <Lock size={11} />} {tv(d.access)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Verification scope */}
          <Section title={t('detail.verificationScope')}>
            <div className="overflow-hidden rounded-xl border border-ink/10">
              <div className={`flex flex-wrap items-center justify-between gap-3 border-b p-5 ${levelTone(p.verification.level)}`}>
                <div>
                  <div className="font-display text-2xl">
                    {t('detail.levelTitle', { level: p.verification.level, name: levelMeta.name })}
                  </div>
                  <div className="mt-1 text-sm opacity-80">
                    {t('detail.checkedByOn', { date: formatDate(p.verification.checkedOn), by: p.verification.checkedBy })}
                  </div>
                </div>
                <ShieldCheck size={28} />
              </div>
              <div className="grid bg-white/60 sm:grid-cols-2">
                <div className="border-b border-ink/10 p-5 sm:border-b-0 sm:border-r">
                  <div className="label">{t('detail.whatWasChecked')}</div>
                  <ul className="space-y-2 text-sm">
                    {p.verification.scope.map((s) => (
                      <li key={s} className="flex gap-2">
                        <Check size={16} className="mt-0.5 shrink-0 text-moss" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-5">
                  <div className="label">{t('detail.whatWasNotVerified')}</div>
                  <ul className="space-y-2 text-sm">
                    {p.verification.notVerified.map((s) => (
                      <li key={s} className="flex gap-2">
                        <CircleSlash size={16} className="mt-0.5 shrink-0 text-danger" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <Link to="/verification" className="mt-3 inline-block text-sm font-semibold text-ochre hover:underline">
              {t('detail.howLevelsWork')}
            </Link>
          </Section>

          <div className="rounded-xl border border-ink/10 bg-paper-2 p-5 text-xs leading-relaxed text-stone">
            <strong className="text-ink">{t('detail.disclaimerTitle')}</strong> {t('detail.disclaimerBody')}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-ink/10 bg-white p-6 shadow-[0_24px_60px_-40px_rgba(21,18,15,0.5)]">
            <div className="label !mb-1">{t('detail.investmentSought')}</div>
            <div className="font-display text-5xl font-light">{formatUsd(p.investmentUsd)}</div>
            <div className="mt-1 font-mono text-xs text-stone">US${p.investmentUsd.toLocaleString()}</div>
            {p.askingPriceUsd && (
              <div className="mt-1 text-sm text-stone">
                {t('detail.askingPrice', { price: formatUsd(p.askingPriceUsd) })}
              </div>
            )}
            <div className="mt-5">
              <div className="label">{t('detail.preferredDealTypes')}</div>
              <div className="flex flex-wrap gap-1.5">
                {p.dealTypes.map((d) => (
                  <span key={d} className="rounded-full border border-sand px-2.5 py-1 text-xs">
                    {tv(d)}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-6 space-y-2.5">
              <button onClick={() => setModal('enquiry')} className="btn-primary w-full">
                <MessageSquareText size={16} /> {t('detail.requestInfo')}
              </button>
              <button onClick={() => setModal('diligence')} className="btn-ghost w-full">
                <Microscope size={16} /> {t('detail.requestDiligence')}
              </button>
              <button onClick={() => toggle(p.id)} className="btn-ghost w-full" aria-pressed={saved}>
                {saved ? <BookmarkCheck size={16} className="text-ochre" /> : <Bookmark size={16} />}
                {saved ? t('detail.savedToShortlist') : t('detail.saveProject')}
              </button>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-ink/10 pt-5 text-sm">
              <div>
                <dt className="label !mb-0.5">{t('detail.enquiries')}</dt>
                <dd className="font-semibold">{p.enquiries}</dd>
              </div>
              <div>
                <dt className="label !mb-0.5">{t('detail.listed')}</dt>
                <dd className="font-semibold">{formatDate(p.listedOn)}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 rounded-2xl border border-ink/10 bg-white/50 p-5">
            <div className="label">{t('detail.listedBy')}</div>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink font-display text-paper">
                {p.owner.name
                  .split(' ')
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')}
              </span>
              <div>
                <div className="font-medium">{p.owner.name}</div>
                <div className="text-xs text-stone">
                  {t('detail.memberSince', { kind: p.owner.kind, year: p.owner.memberSince })}
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-stone">{t('detail.contactReleaseNote')}</p>
          </div>

          <button
            onClick={() => setModal('report')}
            className="mt-4 flex w-full items-center justify-center gap-2 py-2 text-xs font-semibold text-stone hover:text-danger"
          >
            <Flag size={13} /> {t('detail.reportListing')}
          </button>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="border-t border-ink/10 bg-paper-2 px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="font-display mb-8 text-3xl font-light md:text-4xl">{t('detail.similarOpportunities')}</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <ProjectCard key={r.id} project={r} saved={isSaved(r.id)} onToggleSave={toggle} />
              ))}
            </div>
          </div>
        </section>
      )}

      {modal && <ActionModal kind={modal} project={p} onClose={() => setModal(null)} />}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display mb-5 border-b border-ink/10 pb-3 text-2xl">{title}</h2>
      {children}
    </section>
  )
}

function ActionModal({ kind, project, onClose }: { kind: Exclude<Modal, null>; project: Project; onClose: () => void }) {
  const { t } = useI18n()
  const [done, setDone] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const copy = {
    enquiry: {
      title: t('modal.enquiry.title'),
      intro: t('modal.enquiry.intro'),
      cta: t('modal.enquiry.cta'),
    },
    diligence: {
      title: t('modal.diligence.title'),
      intro: t('modal.diligence.intro'),
      cta: t('modal.diligence.cta'),
    },
    report: {
      title: t('modal.report.title'),
      intro: t('modal.report.intro'),
      cta: t('modal.report.cta'),
    },
  }[kind]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const errs: Record<string, string> = {}
    if (kind !== 'report') {
      if (!String(data.get('name') ?? '').trim()) errs.name = t('modal.err.name')
      if (!/^\S+@\S+\.\S+$/.test(String(data.get('email') ?? ''))) errs.email = t('modal.err.email')
      if (!data.get('terms')) errs.terms = t('modal.err.terms')
    }
    if (!String(data.get('message') ?? '').trim()) {
      errs.message = kind === 'report' ? t('modal.err.reportMsg') : t('modal.err.shortMsg')
    }
    if (!data.get('privacy')) errs.privacy = t('modal.err.privacy')
    setErrors(errs)
    if (Object.keys(errs).length) return
    const prefix = kind === 'enquiry' ? 'ENQ' : kind === 'diligence' ? 'DDQ' : 'RPT'
    setDone(`${prefix}-${project.id.slice(3)}-${Math.floor(1000 + Math.random() * 9000)}`)
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center" role="dialog" aria-modal aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-fade" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-paper p-6 shadow-2xl animate-rise sm:max-w-lg sm:rounded-2xl sm:p-8">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1.5 text-stone hover:bg-ink/5" aria-label={t('modal.close')}>
          <X size={18} />
        </button>

        {done ? (
          <div className="py-6 text-center">
            <CheckCircle2 size={44} className="mx-auto text-moss" />
            <h2 id="modal-title" className="font-display mt-5 text-3xl">
              {kind === 'report' ? t('modal.reportReceived') : t('modal.requestRecorded')}
            </h2>
            <p className="mt-3 text-stone">
              {kind === 'report' ? t('modal.reportThanks') : t('modal.requestThanks')}
            </p>
            <div className="mx-auto mt-6 inline-block rounded-lg border border-ink/10 bg-white px-4 py-2 font-mono text-sm">{done}</div>
            <button onClick={onClose} className="btn-primary mt-8 w-full">
              {t('modal.done')}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <p className="eyebrow text-ochre">{project.id}</p>
            <h2 id="modal-title" className="font-display mt-2 text-3xl">
              {copy.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone">{copy.intro}</p>

            <div className="mt-6 space-y-4">
              {kind !== 'report' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t('modal.fullName')} name="name" error={errors.name} />
                    <Field label={t('modal.email')} name="email" type="email" error={errors.email} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t('modal.organisation')} name="org" />
                    <label className="block">
                      <span className="label">{t('modal.youAre')}</span>
                      <select name="role" className="field">
                        <option>{t('modal.role.individual')}</option>
                        <option>{t('modal.role.investmentCo')}</option>
                        <option>{t('modal.role.miningCo')}</option>
                        <option>{t('modal.role.serviceProvider')}</option>
                      </select>
                    </label>
                  </div>
                </>
              )}
              {kind === 'report' && (
                <label className="block">
                  <span className="label">{t('modal.reason')}</span>
                  <select name="reason" className="field">
                    <option>{t('modal.reason.misleading')}</option>
                    <option>{t('modal.reason.expired')}</option>
                    <option>{t('modal.reason.duplicate')}</option>
                    <option>{t('modal.reason.fraud')}</option>
                    <option>{t('modal.reason.other')}</option>
                  </select>
                </label>
              )}
              <label className="block">
                <span className="label">{kind === 'report' ? t('modal.details') : t('modal.message')}</span>
                <textarea
                  name="message"
                  rows={4}
                  className="field resize-none"
                  placeholder={
                    kind === 'enquiry'
                      ? t('modal.placeholder.enquiry')
                      : kind === 'diligence'
                        ? t('modal.placeholder.diligence')
                        : t('modal.placeholder.report')
                  }
                />
                {errors.message && <span className="mt-1 block text-xs text-danger">{errors.message}</span>}
              </label>

              {kind !== 'report' && (
                <Check2 name="terms" error={errors.terms}>
                  {t('modal.termsConsent')}
                </Check2>
              )}
              <Check2 name="privacy" error={errors.privacy}>
                {t('modal.privacyConsent')}
              </Check2>
            </div>

            <button type="submit" className="btn-primary mt-6 w-full">
              {copy.cta}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, name, type = 'text', error }: { label: string; name: string; type?: string; error?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input name={name} type={type} className={`field ${error ? '!border-danger' : ''}`} aria-invalid={!!error} />
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  )
}

function Check2({ name, error, children }: { name: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer gap-3 text-xs leading-relaxed text-ink/80">
      <input type="checkbox" name={name} className="mt-0.5 h-4 w-4 shrink-0 accent-ochre" />
      <span>
        {children}
        {error && <span className="mt-1 block text-danger">{error}</span>}
      </span>
    </label>
  )
}
