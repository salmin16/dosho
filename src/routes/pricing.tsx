import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { useI18n } from '../i18n'

export const Route = createFileRoute('/pricing')({
  head: () => ({ meta: [{ title: 'Membership & pricing — MineConnect' }] }),
  component: Pricing,
})

function Pricing() {
  const { t, fixtures } = useI18n()
  const [yearly, setYearly] = useState(false)

  return (
    <div className="pt-[72px]">
      <section className="px-5 pb-12 pt-16 text-center lg:px-8">
        <p className="eyebrow mb-4 text-ochre">{t('pricing.eyebrow')}</p>
        <h1 className="font-display mx-auto max-w-3xl text-5xl font-light leading-[1] md:text-6xl">
          {t('pricing.titlePre')}
          <em className="italic text-ochre">{t('pricing.titleEm')}</em>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-stone">{t('pricing.subtitle')}</p>
        <div className="mt-8 inline-flex flex-wrap justify-center rounded-lg border border-ink/15 bg-white/60 p-1">
          {(
            [
              ['monthly', t('pricing.monthly'), false],
              ['yearly', t('pricing.yearly'), true],
            ] as const
          ).map(([id, label, isYearly]) => (
            <button
              key={id}
              onClick={() => setYearly(isYearly)}
              className={`rounded-md px-5 py-2 text-sm font-semibold transition ${isYearly === yearly ? 'bg-ink text-paper' : 'text-stone'}`}
            >
              {label}
              {isYearly && <span className="ml-1.5 text-xs text-gold">{t('pricing.twoMonthsFree')}</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 pb-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-5">
          {fixtures.plans.map((p) => {
            const hl = 'highlighted' in p && p.highlighted
            return (
              <article
                key={p.id}
                id={p.id}
                className={`relative flex flex-col rounded-2xl border p-6 ${hl ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-white/60'}`}
              >
                {hl && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gold px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink">
                    {t('pricing.forInvestors')}
                  </span>
                )}
                <h2 className="font-display text-2xl">{p.name}</h2>
                <p className={`mt-1 text-sm ${hl ? 'text-paper/60' : 'text-stone'}`}>{p.audience}</p>
                <div className="mt-6">
                  <span className="font-display text-3xl">{yearly && 'yearly' in p && p.yearly ? p.yearly.split('/')[0] : p.price}</span>
                  <span className={`text-sm ${hl ? 'text-paper/60' : 'text-stone'}`}>
                    {yearly && 'yearly' in p && p.yearly ? t('pricing.perYear') : p.period}
                  </span>
                </div>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check size={15} className={`mt-0.5 shrink-0 ${hl ? 'text-gold' : 'text-moss'}`} /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to={p.id === 'miner' || p.id === 'professional' ? '/list-a-project' : '/opportunities'}
                  className={`mt-8 ${hl ? 'btn-primary' : 'btn-ghost'} w-full`}
                >
                  {p.id === 'explorer'
                    ? t('pricing.startExploring')
                    : p.id === 'corporate'
                      ? t('pricing.talkToUs')
                      : t('pricing.joinPilot')}
                </Link>
              </article>
            )
          })}
        </div>
      </section>

      <section className="border-t border-ink/10 bg-paper-2 px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-4xl font-light">{t('pricing.feesTitle')}</h2>
          <p className="mt-3 text-stone">{t('pricing.feesSubtitle')}</p>
          <div className="mt-8 overflow-x-auto rounded-xl border border-ink/10 bg-white/70">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 font-mono text-[11px] uppercase tracking-wider text-stone">
                  <th className="px-5 py-4 font-normal">{t('pricing.col.product')}</th>
                  <th className="px-5 py-4 font-normal">{t('pricing.col.price')}</th>
                  <th className="px-5 py-4 font-normal">{t('pricing.col.customer')}</th>
                  <th className="px-5 py-4 font-normal">{t('pricing.col.basis')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {fixtures.servicesPricing.map((r) => (
                  <tr key={r.product} className="hover:bg-paper/60">
                    <td className="px-5 py-4 font-medium">{r.product}</td>
                    <td className="px-5 py-4 font-display text-lg">{r.price}</td>
                    <td className="px-5 py-4 text-stone">{r.customer}</td>
                    <td className="px-5 py-4 text-stone">{r.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-stone">{t('pricing.footnote')}</p>
          <Link to="/faq" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-ochre hover:underline">
            {t('pricing.faqLink')} <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  )
}
