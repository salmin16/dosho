import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { BadgeCheck, Clock, Lock, MapPin, Star, CheckCircle2, X } from 'lucide-react'
import { SERVICE_CATEGORIES, type ServiceProvider } from '../data/fixtures'
import { useI18n } from '../i18n'
import {
  createGroundedQuoteRequest,
  getSession,
  useAuthSession,
} from '../lib/supabaseAuth'
import { useCurrency } from '../lib/currency'

export const Route = createFileRoute('/services')({
  validateSearch: (s: Record<string, unknown>): { category?: string } => ({
    category: typeof s.category === 'string' && s.category ? s.category : undefined,
  }),
  head: () => ({ meta: [{ title: 'Mining services marketplace — MineConnect' }] }),
  component: Services,
})

function Services() {
  const { t, tv, fixtures } = useI18n()
  const { category } = Route.useSearch()
  const navigate = useNavigate()
  const session = useAuthSession()
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [quoteFor, setQuoteFor] = useState<ServiceProvider | null>(null)
  const list = fixtures.serviceProviders.filter(
    (s) => (!category || s.category === category) && (!verifiedOnly || s.verified)
  )

  const handleRequestQuoteClick = (provider: ServiceProvider) => {
    const activeSession = getSession()
    if (!activeSession) {
      navigate({
        to: '/signup',
        search: { next: '/services', reason: 'request_quote' } as unknown as undefined,
      })
      return
    }
    setQuoteFor(provider)
  }

  return (
    <div className="pt-[72px]">
      <section className="border-b border-ink/10 bg-paper-2">
        <div className="mx-auto max-w-7xl px-5 pb-10 pt-14 lg:px-8">
          <p className="eyebrow mb-3 text-ochre">{t('services.eyebrow')}</p>
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h1 className="font-display max-w-3xl text-5xl font-light leading-none md:text-6xl">
              {t('services.title')}
            </h1>
            <label className="flex items-center gap-2.5 text-sm font-medium">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="h-4 w-4 accent-ochre"
              />
              {t('services.verifiedOnly')}
            </label>
          </div>
          <div className="mt-10 flex gap-2 overflow-x-auto pb-1">
            <CatChip on={!category} onClick={() => navigate({ to: '/services', search: {} })}>
              {t('services.allCategories')}
            </CatChip>
            {SERVICE_CATEGORIES.map((c) => (
              <CatChip
                key={c}
                on={category === c}
                onClick={() => navigate({ to: '/services', search: { category: c } })}
              >
                {tv(c)}
              </CatChip>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        {list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink/20 px-6 py-20 text-center">
            <h2 className="font-display text-3xl">{t('services.emptyTitle')}</h2>
            <p className="mt-2 text-stone">{t('services.emptyBody')}</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {list.map((s) => (
              <article
                key={s.id}
                className="flex flex-col rounded-2xl border border-ink/10 bg-white/60 p-6 transition hover:border-ink/25 hover:bg-white"
              >
                <div className="flex items-start gap-4">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-ink font-display text-lg text-gold">
                    {s.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-2xl leading-tight">{s.name}</h2>
                      {s.verified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-moss-light px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-moss">
                          <BadgeCheck size={12} /> {t('services.verifiedBadge')}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ochre">{tv(s.category)}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-stone">{s.summary}</p>
                <div className="mb-6 mt-4 flex flex-wrap gap-1.5">
                  {s.services.map((x) => (
                    <span key={x} className="rounded-full border border-sand px-2.5 py-1 text-xs">
                      {x}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-5 text-sm">
                  <div className="flex flex-wrap gap-4 text-stone">
                    <span className="flex items-center gap-1">
                      <Star size={14} className="fill-gold text-gold" />{' '}
                      <strong className="text-ink">{s.rating}</strong> ({s.reviews})
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={14} /> {s.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} /> {s.responseTime}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRequestQuoteClick(s)}
                    className="btn-primary !py-2"
                  >
                    {!session && <Lock size={13} />}
                    {t('services.requestQuote')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="mt-10 text-xs text-stone">{t('services.footnote')}</p>
      </div>

      {quoteFor && <QuoteModal provider={quoteFor} onClose={() => setQuoteFor(null)} />}
    </div>
  )
}

function CatChip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
        on ? 'border-ink bg-ink text-paper' : 'border-ink/15 bg-paper hover:border-ink/40'
      }`}
    >
      {children}
    </button>
  )
}

function QuoteModal({
  provider,
  onClose,
}: {
  provider: ServiceProvider
  onClose: () => void
}) {
  const { t, tv } = useI18n()
  const navigate = useNavigate()
  const session = useAuthSession()
  const { currency, currencyMeta, toUsd, formatExactUsd } = useCurrency()

  const [budgetInput, setBudgetInput] = useState('25000')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const numericBudget = parseFloat(budgetInput) || 0
  const normalizedUsd = toUsd(numericBudget)

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center"
      role="dialog"
      aria-modal
    >
      <div
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-fade"
        onClick={onClose}
      />
      <div className="relative w-full rounded-t-2xl bg-paper p-6 shadow-2xl animate-rise sm:max-w-md sm:rounded-2xl sm:p-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-stone hover:bg-ink/5"
          aria-label={t('modal.close')}
        >
          <X size={18} />
        </button>
        {sent ? (
          <div className="py-6 text-center">
            <CheckCircle2 size={44} className="mx-auto text-moss" />
            <h2 className="font-display mt-4 text-3xl">
              {t('services.modal.quoteRequested')}
            </h2>
            <p className="mt-2 text-stone">
              {t('services.modal.respondsIn', {
                name: provider.name,
                time: provider.responseTime,
              })}
            </p>
            <p className="mt-2 font-mono text-xs text-moss">
              Grounded to your Vault ({formatExactUsd(normalizedUsd)})
            </p>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose()
                  navigate({ to: '/dashboard' })
                }}
                className="btn-ghost flex-1"
              >
                View in Vault
              </button>
              <button onClick={onClose} className="btn-primary flex-1">
                {t('modal.done')}
              </button>
            </div>
          </div>
        ) : (
          <form
            noValidate
            onSubmit={async (e) => {
              e.preventDefault()
              if (!getSession()) {
                onClose()
                navigate({
                  to: '/signup',
                  search: { next: '/services', reason: 'request_quote' } as unknown as undefined,
                })
                return
              }
              const d = new FormData(e.currentTarget)
              const emailVal = String(d.get('email') || session?.user.email || '').trim()
              const scopeVal = String(d.get('scope') || '').trim()
              const serviceVal = String(d.get('service') || provider.services[0] || '')

              if (!/^\S+@\S+\.\S+$/.test(emailVal) || !scopeVal) {
                setErr(t('services.modal.err'))
                return
              }

              setSubmitting(true)
              try {
                const res = await createGroundedQuoteRequest({
                  providerId: provider.id,
                  providerName: provider.name,
                  serviceRequested: serviceVal,
                  estimatedBudgetUsd: normalizedUsd,
                  currencyCode: currency,
                  scopeNotes: scopeVal,
                })
                if (res.error) {
                  setErr(res.error)
                  return
                }
                setSent(true)
              } finally {
                setSubmitting(false)
              }
            }}
          >
            <p className="eyebrow text-ochre">{tv(provider.category)}</p>
            <h2 className="font-display mt-2 text-3xl">
              {t('services.modal.requestTitle')}
            </h2>
            <p className="mt-1 text-sm text-stone">
              {t('services.modal.fromProvider', { name: provider.name })}
            </p>
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="label">{t('services.modal.email')}</span>
                <input
                  name="email"
                  type="email"
                  defaultValue={session?.user.email ?? ''}
                  className="field"
                />
              </label>
              <label className="block">
                <span className="label">{t('services.modal.serviceNeeded')}</span>
                <select name="service" className="field">
                  {provider.services.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">
                  Estimated Budget ({currencyMeta.flag} {currency})
                </span>
                <input
                  name="budget"
                  type="number"
                  min="0"
                  step="any"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="field"
                />
                {currency !== 'USD' && (
                  <span className="mt-1 block font-mono text-[11px] text-stone">
                    Normalized USD Equivalent: US${normalizedUsd.toLocaleString('en-US')}
                  </span>
                )}
              </label>
              <label className="block">
                <span className="label">{t('services.modal.scopeLocation')}</span>
                <textarea
                  name="scope"
                  rows={3}
                  className="field resize-none"
                  placeholder={t('services.modal.scopePlaceholder')}
                />
              </label>
              {err && <p className="text-xs text-danger">{err}</p>}
            </div>
            <button disabled={submitting} className="btn-primary mt-6 w-full">
              {submitting ? 'Submitting Grounded Quote...' : t('services.modal.sendRequest')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
