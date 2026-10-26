import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, UploadCloud, FileText, X } from 'lucide-react'
import { MINERALS, OPPORTUNITY_TYPES, REGIONS, STAGES } from '../data/fixtures'
import { useI18n, type TranslationKey } from '../i18n'

export const Route = createFileRoute('/list-a-project')({
  head: () => ({ meta: [{ title: 'List a project — MineConnect' }] }),
  component: ListProject,
})

const STEP_KEYS: TranslationKey[] = [
  'list.step.0',
  'list.step.1',
  'list.step.2',
  'list.step.3',
  'list.step.4',
  'list.step.5',
]

type Form = Record<string, string | string[] | boolean>

function ListProject() {
  const { t, tv, fixtures } = useI18n()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>({
    ownerKind: 'Individual',
    minerals: [],
    dealTypes: [],
    evidence: [],
    files: [],
    pkg: 'verified',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState<string | null>(null)

  const v = (k: string) => (form[k] as string) ?? ''
  const arr = (k: string) => (form[k] as string[]) ?? []
  const set = (k: string, val: Form[string]) => setForm((f) => ({ ...f, [k]: val }))
  const toggleIn = (k: string, item: string) =>
    set(k, arr(k).includes(item) ? arr(k).filter((x) => x !== item) : [...arr(k), item])

  const packages = fixtures.listPackages

  const validate = () => {
    const e: Record<string, string> = {}
    const req = (k: string, msg: string) => !v(k).trim() && (e[k] = msg)
    if (step === 0) {
      req('name', t('list.err.required'))
      if (!/^\S+@\S+\.\S+$/.test(v('email'))) e.email = t('list.err.email')
      req('phone', t('list.err.required'))
      if (v('ownerKind') === 'Company') req('company', t('list.err.company'))
    }
    if (step === 1) {
      req('title', t('list.err.title'))
      if (!arr('minerals').length) e.minerals = t('list.err.minerals')
      req('type', t('list.err.required'))
      req('region', t('list.err.required'))
      req('district', t('list.err.required'))
    }
    if (step === 2) {
      req('licenceType', t('list.err.required'))
      req('licenceRef', t('list.err.required'))
      req('licenceStatus', t('list.err.required'))
      req('area', t('list.err.required'))
    }
    if (step === 3) {
      req('stage', t('list.err.required'))
      req('summary', t('list.err.summary'))
      req('investment', t('list.err.required'))
    }
    if (step === 5) {
      if (!form.declTrue) e.declTrue = t('list.err.required')
      if (!form.declNoGuarantee) e.declNoGuarantee = t('list.err.required')
      if (!form.declTerms) e.declTerms = t('list.err.required')
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (!validate()) return
    if (step === STEP_KEYS.length - 1) {
      setSubmitted(`MC-SUB-${Math.floor(10000 + Math.random() * 89999)}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setStep((s) => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-5 pb-28 pt-40 text-center">
        <CheckCircle2 size={56} className="mx-auto text-moss" />
        <h1 className="font-display mt-6 text-5xl font-light">{t('list.submitted.title')}</h1>
        <p className="mt-4 text-lg text-stone">
          {t('list.submitted.subtitlePre')} <strong className="text-ink">{v('title')}</strong> {t('list.submitted.subtitlePost')}
        </p>
        <div className="mx-auto mt-6 inline-block rounded-lg border border-ink/10 bg-white px-5 py-2.5 font-mono">{submitted}</div>
        <ol className="mx-auto mt-12 max-w-md space-y-4 text-left">
          {[
            [t('list.submitted.s1.t'), t('list.submitted.s1.d')],
            [t('list.submitted.s2.t'), t('list.submitted.s2.d')],
            [t('list.submitted.s3.t'), t('list.submitted.s3.d')],
            [t('list.submitted.s4.t'), t('list.submitted.s4.d')],
          ].map(([title, desc], i) => (
            <li key={title} className="flex gap-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink font-mono text-xs text-paper">{i + 1}</span>
              <div>
                <div className="font-semibold">{title}</div>
                <div className="text-sm text-stone">{desc}</div>
              </div>
            </li>
          ))}
        </ol>
        <Link to="/opportunities" className="btn-primary mt-12">
          {t('list.submitted.browse')}
        </Link>
      </div>
    )
  }

  const selectPlaceholder = t('list.selectPlaceholder')

  return (
    <div className="pt-[72px]">
      <section className="border-b border-ink/10 bg-paper-2">
        <div className="mx-auto max-w-5xl px-5 pb-10 pt-14 lg:px-8">
          <p className="eyebrow mb-3 text-ochre">{t('list.eyebrow')}</p>
          <h1 className="font-display text-5xl font-light leading-none md:text-6xl">{t('list.title')}</h1>
          <p className="mt-4 max-w-2xl text-stone">{t('list.subtitle')}</p>
          <ol className="mt-10 grid grid-cols-6 gap-2">
            {STEP_KEYS.map((sk, i) => (
              <li key={sk}>
                <button
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className="group w-full text-left disabled:cursor-default"
                >
                  <div className={`h-1 rounded-full transition ${i <= step ? 'bg-ochre' : 'bg-ink/10'}`} />
                  <div className={`mt-2 hidden truncate font-mono text-[10px] uppercase tracking-wider sm:block ${i === step ? 'text-ink' : 'text-stone'}`}>
                    {String(i + 1).padStart(2, '0')} {t(sk)}
                  </div>
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-stone sm:hidden">
            {t('list.stepOf', { step: step + 1, total: STEP_KEYS.length, name: t(STEP_KEYS[step]) })}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
        <div key={step} className="animate-rise">
          {step === 0 && (
            <Grid>
              <Seg
                label={t('list.submittingAs')}
                options={['Individual', 'Company']}
                renderOption={tv}
                value={v('ownerKind')}
                onChange={(x) => set('ownerKind', x)}
              />
              {v('ownerKind') === 'Company' && <In label={t('list.companyName')} k="company" {...{ v, set, errors }} />}
              <In label={t('list.fullName')} k="name" {...{ v, set, errors }} />
              <In label={t('list.email')} k="email" type="email" {...{ v, set, errors }} />
              <In label={t('list.phone')} k="phone" placeholder="+255 …" {...{ v, set, errors }} />
              <Sel
                label={t('list.yourRole')}
                k="ownerRole"
                selectPlaceholder={selectPlaceholder}
                options={[t('list.role.holder'), t('list.role.rep'), t('list.role.coop'), t('list.role.director')]}
                {...{ v, set, errors }}
              />
              <Note className="sm:col-span-2">{t('list.kycNote')}</Note>
            </Grid>
          )}

          {step === 1 && (
            <Grid>
              <In
                label={t('list.projectTitle')}
                k="title"
                placeholder={t('list.projectTitlePlaceholder')}
                className="sm:col-span-2"
                {...{ v, set, errors }}
              />
              <div className="sm:col-span-2">
                <span className="label">{t('list.minerals')}</span>
                <div className="flex flex-wrap gap-2">
                  {MINERALS.map((m) => (
                    <Chip key={m} on={arr('minerals').includes(m)} onClick={() => toggleIn('minerals', m)}>
                      {tv(m)}
                    </Chip>
                  ))}
                </div>
                {errors.minerals && <Err>{errors.minerals}</Err>}
              </div>
              <Sel
                label={t('list.opportunityType')}
                k="type"
                selectPlaceholder={selectPlaceholder}
                options={OPPORTUNITY_TYPES}
                renderOption={tv}
                {...{ v, set, errors }}
              />
              <Sel
                label={t('list.region')}
                k="region"
                selectPlaceholder={selectPlaceholder}
                options={[...REGIONS].sort()}
                {...{ v, set, errors }}
              />
              <In label={t('list.district')} k="district" {...{ v, set, errors }} />
              <In label={t('list.ward')} k="ward" {...{ v, set, errors }} />
              <Seg
                label={t('list.locationDisclosure')}
                options={['Approximate', 'Exact on NDA']}
                renderOption={tv}
                value={v('disclosure') || 'Approximate'}
                onChange={(x) => set('disclosure', x)}
              />
            </Grid>
          )}

          {step === 2 && (
            <Grid>
              <Sel
                label={t('list.licenceType')}
                k="licenceType"
                selectPlaceholder={selectPlaceholder}
                options={['PML', 'PL', 'ML', 'SML', 'Processing Licence', 'Other mineral-trade licence']}
                renderOption={tv}
                {...{ v, set, errors }}
              />
              <In
                label={t('list.licenceRef')}
                k="licenceRef"
                placeholder={t('list.licenceRefPlaceholder')}
                {...{ v, set, errors }}
              />
              <Sel
                label={t('list.licenceStatus')}
                k="licenceStatus"
                selectPlaceholder={selectPlaceholder}
                options={['Active', 'Renewal pending', 'Application stage']}
                renderOption={tv}
                {...{ v, set, errors }}
              />
              <In label={t('list.areaHa')} k="area" type="number" {...{ v, set, errors }} />
              <In label={t('list.issueDate')} k="issued" type="date" {...{ v, set, errors }} />
              <In label={t('list.expiryDate')} k="expires" type="date" {...{ v, set, errors }} />
              <Note className="sm:col-span-2">{t('list.licenceNote')}</Note>
            </Grid>
          )}

          {step === 3 && (
            <Grid>
              <Sel
                label={t('list.projectStage')}
                k="stage"
                selectPlaceholder={selectPlaceholder}
                options={STAGES}
                renderOption={tv}
                {...{ v, set, errors }}
              />
              <In
                label={t('list.investmentRequired')}
                k="investment"
                type="number"
                placeholder={t('list.investmentPlaceholder')}
                {...{ v, set, errors }}
              />
              <label className="block sm:col-span-2">
                <span className="label">{t('list.projectSummary')}</span>
                <textarea
                  rows={4}
                  value={v('summary')}
                  onChange={(e) => set('summary', e.target.value)}
                  className={`field resize-none ${errors.summary ? '!border-danger' : ''}`}
                  placeholder={t('list.summaryPlaceholder')}
                />
                {errors.summary && <Err>{errors.summary}</Err>}
              </label>
              <div className="sm:col-span-2">
                <span className="label">{t('list.evidenceAvailable')}</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Geological mapping',
                    'Sampling / assays',
                    'Drilling data',
                    'Technical report',
                    'Production records',
                    'Environmental approvals',
                    'Photos / video',
                  ].map((x) => (
                    <Chip key={x} on={arr('evidence').includes(x)} onClick={() => toggleIn('evidence', x)}>
                      {tv(x)}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <span className="label">{t('list.preferredDealTypes')}</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Equity partnership',
                    'Joint venture',
                    'Earn-in',
                    'Equipment financing',
                    'Project finance',
                    'Offtake',
                    'Assignment of rights',
                  ].map((x) => (
                    <Chip key={x} on={arr('dealTypes').includes(x)} onClick={() => toggleIn('dealTypes', x)}>
                      {tv(x)}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
                <span className="label">{t('list.documents')}</span>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-sand bg-white/50 px-6 py-10 text-center transition hover:border-ochre">
                  <UploadCloud className="text-ochre" />
                  <span className="mt-3 text-sm font-medium">{t('list.dropFiles')}</span>
                  <span className="mt-1 text-xs text-stone">{t('list.filesHint')}</span>
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(e) => set('files', [...arr('files'), ...Array.from(e.target.files ?? []).map((f) => f.name)])}
                  />
                </label>
                {arr('files').length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {arr('files').map((f) => (
                      <li key={f} className="flex items-center justify-between rounded-md border border-ink/10 bg-white px-3 py-2 text-sm">
                        <span className="flex items-center gap-2">
                          <FileText size={15} className="text-stone" /> {f}
                        </span>
                        <button onClick={() => set('files', arr('files').filter((x) => x !== f))} aria-label={`Remove ${f}`}>
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Grid>
          )}

          {step === 4 && (
            <div className="grid gap-4 md:grid-cols-3">
              {packages.map((p) => {
                const on = v('pkg') === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => set('pkg', p.id)}
                    aria-pressed={on}
                    className={`relative rounded-2xl border p-6 text-left transition ${
                      on ? 'border-ochre bg-white shadow-[0_0_0_3px_rgba(192,97,43,0.15)]' : 'border-ink/10 bg-white/50 hover:border-ink/30'
                    }`}
                  >
                    {p.recommended && (
                      <span className="absolute -top-3 left-6 rounded-full bg-ochre px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-paper">
                        {t('list.recommended')}
                      </span>
                    )}
                    <div className="font-display text-2xl">{p.name}</div>
                    <div className="mt-2 font-semibold">{p.price}</div>
                    <div className="text-xs text-stone">{p.note}</div>
                    <ul className="mt-5 space-y-2 text-sm">
                      {p.points.map((x) => (
                        <li key={x} className="flex gap-2">
                          <Check size={15} className="mt-0.5 shrink-0 text-moss" /> {x}
                        </li>
                      ))}
                    </ul>
                  </button>
                )
              })}
              <Note className="md:col-span-3">{t('list.pkgNote')}</Note>
            </div>
          )}

          {step === 5 && (
            <div className="grid gap-8 md:grid-cols-[1fr_1fr]">
              <dl className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-white/60 text-sm">
                {[
                  [t('list.review.owner'), `${v('name')} (${tv(v('ownerKind'))}${v('company') ? ` · ${v('company')}` : ''})`],
                  [t('list.review.project'), v('title')],
                  [t('list.review.minerals'), arr('minerals').map(tv).join(', ')],
                  [t('list.review.type'), tv(v('type'))],
                  [t('list.review.location'), `${v('district')}, ${v('region')}`],
                  [t('list.review.licence'), `${tv(v('licenceType'))} · ${tv(v('licenceStatus'))} · ${v('area')} ha`],
                  [t('list.review.stage'), tv(v('stage'))],
                  [t('list.review.investment'), v('investment') ? `US$${Number(v('investment')).toLocaleString()}` : ''],
                  [t('list.review.package'), packages.find((p) => p.id === v('pkg'))?.name ?? ''],
                ].map(([k, val]) => (
                  <div key={k} className="grid grid-cols-[120px_1fr] gap-3 px-5 py-3">
                    <dt className="label !mb-0 pt-0.5">{k}</dt>
                    <dd className="break-words">{val || <span className="text-stone">—</span>}</dd>
                  </div>
                ))}
              </dl>
              <div className="space-y-4">
                <h2 className="font-display text-2xl">{t('list.declarations')}</h2>
                {(
                  [
                    ['declTrue', t('list.declTrue')],
                    ['declNoGuarantee', t('list.declNoGuarantee')],
                    ['declTerms', t('list.declTerms')],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="flex cursor-pointer gap-3 rounded-lg border border-ink/10 bg-white/60 p-4 text-sm leading-relaxed">
                    <input type="checkbox" checked={!!form[k]} onChange={(e) => set(k, e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-ochre" />
                    <span>
                      {label}
                      {errors[k] && <Err>{t('list.confirmContinue')}</Err>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-12 flex items-center justify-between border-t border-ink/10 pt-6">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn-ghost disabled:opacity-30">
            <ArrowLeft size={16} /> {t('list.back')}
          </button>
          <button onClick={next} className="btn-primary">
            {step === STEP_KEYS.length - 1 ? t('list.submitModeration') : t('list.continue')} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2">{children}</div>
}

function Err({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 block text-xs text-danger">{children}</span>
}

function Note({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`rounded-lg border border-gold/40 bg-gold/10 p-4 text-xs leading-relaxed text-ink/80 ${className}`}>{children}</p>
}

type FieldProps = {
  label: string
  k: string
  v: (k: string) => string
  set: (k: string, val: string) => void
  errors: Record<string, string>
  className?: string
}

function In({ label, k, v, set, errors, type = 'text', placeholder, className = '' }: FieldProps & { type?: string; placeholder?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      <input
        type={type}
        value={v(k)}
        placeholder={placeholder}
        onChange={(e) => set(k, e.target.value)}
        className={`field ${errors[k] ? '!border-danger' : ''}`}
        aria-invalid={!!errors[k]}
      />
      {errors[k] && <Err>{errors[k]}</Err>}
    </label>
  )
}

function Sel({
  label,
  k,
  v,
  set,
  errors,
  options,
  selectPlaceholder,
  renderOption,
  className = '',
}: FieldProps & { options: readonly string[]; selectPlaceholder: string; renderOption?: (o: string) => string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      <select value={v(k)} onChange={(e) => set(k, e.target.value)} className={`field ${errors[k] ? '!border-danger' : ''}`}>
        <option value="">{selectPlaceholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {renderOption ? renderOption(o) : o}
          </option>
        ))}
      </select>
      {errors[k] && <Err>{errors[k]}</Err>}
    </label>
  )
}

function Seg({
  label,
  options,
  renderOption,
  value,
  onChange,
}: {
  label: string
  options: string[]
  renderOption?: (o: string) => string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="inline-flex flex-wrap rounded-md border border-sand bg-white/60 p-0.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded px-4 py-2 text-sm font-medium transition ${value === o ? 'bg-ink text-paper' : 'text-stone hover:text-ink'}`}
          >
            {renderOption ? renderOption(o) : o}
          </button>
        ))}
      </div>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition ${
        on ? 'border-ink bg-ink text-paper' : 'border-sand bg-white/60 hover:border-ink/40'
      }`}
    >
      {on && <Check size={13} />} {children}
    </button>
  )
}
