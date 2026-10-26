import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Check, CircleSlash, Clock, UserCheck, CalendarCheck } from 'lucide-react'
import { PROJECTS } from '../data/fixtures'
import { levelTone } from '../components/VerificationBadge'
import { useI18n } from '../i18n'

export const Route = createFileRoute('/verification')({
  head: () => ({ meta: [{ title: 'Verification framework — MineConnect' }] }),
  component: Verification,
})

function Verification() {
  const { t, fixtures } = useI18n()
  const levels = fixtures.verificationLevels
  const counts = levels.map((v) => PROJECTS.filter((p) => p.verification.level === v.level).length)
  const max = Math.max(...counts)

  return (
    <div className="pt-[72px]">
      <section className="relative overflow-hidden bg-ink text-paper">
        <div className="contours absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <p className="eyebrow mb-4 text-gold">{t('verif.eyebrow')}</p>
          <h1 className="font-display max-w-4xl text-5xl font-light leading-[1] md:text-7xl">
            {t('verif.titlePre')}
            <em className="italic text-gold">{t('verif.titleEm')}</em>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-paper/70">{t('verif.subtitle')}</p>
          <div className="mt-12 grid max-w-3xl gap-6 sm:grid-cols-3">
            {[
              [UserCheck, t('verif.whoTitle'), t('verif.whoBody')],
              [CalendarCheck, t('verif.whenTitle'), t('verif.whenBody')],
              [CircleSlash, t('verif.whatNotTitle'), t('verif.whatNotBody')],
            ].map(([Icon, title, d]) => {
              const I = Icon as typeof Clock
              return (
                <div key={title as string} className="border-t border-paper/15 pt-4">
                  <I size={20} className="text-gold" />
                  <div className="mt-3 font-semibold">{title as string}</div>
                  <p className="mt-1 text-sm text-paper/60">{d as string}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-5">
          {levels.map((v, i) => (
            <article key={v.level} className="grid overflow-hidden rounded-2xl border border-ink/10 bg-white/50 md:grid-cols-[220px_1fr_1fr]">
              <div className={`flex flex-col justify-between border-b p-6 md:border-b-0 md:border-r ${levelTone(v.level)}`}>
                <span className="font-display text-6xl font-light">L{v.level}</span>
                <div>
                  <div className="font-display text-xl">{v.name}</div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-current/15">
                    <div className="h-full rounded-full bg-current" style={{ width: `${(counts[i] / max) * 100}%` }} />
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wider opacity-70">
                    {t('verif.pilotListings', { count: counts[i] })}
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="leading-relaxed">{v.description}</p>
                <div className="label mt-5">{t('verif.checksPerformed')}</div>
                <ul className="space-y-1.5 text-sm">
                  {v.checks.map((c) => (
                    <li key={c} className="flex gap-2">
                      <Check size={15} className="mt-0.5 shrink-0 text-moss" /> {c}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-t border-ink/10 bg-paper-2/60 p-6 md:border-l md:border-t-0">
                <div className="label">{t('verif.limitsOfLevel')}</div>
                <p className="flex gap-2 text-sm leading-relaxed text-stone">
                  <CircleSlash size={15} className="mt-0.5 shrink-0 text-danger" /> {v.notCovered}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-ink/10 bg-paper-2 px-5 py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl font-light">{t('verif.whatIsNotTitle')}</h2>
            <ul className="mt-6 space-y-4 text-stone">
              {[t('verif.not1'), t('verif.not2'), t('verif.not3'), t('verif.not4')].map((item) => (
                <li key={item} className="flex gap-3">
                  <CircleSlash size={18} className="mt-0.5 shrink-0 text-danger" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-ink p-8 text-paper md:p-10">
            <h3 className="font-display text-3xl font-light">{t('verif.ctaTitle')}</h3>
            <p className="mt-3 text-paper/70">{t('verif.ctaBody')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/list-a-project" className="btn-primary">
                {t('verif.ctaListBtn')} <ArrowRight size={16} />
              </Link>
              <Link to="/pricing" className="btn-ghost !border-paper/25">
                {t('verif.ctaPricingBtn')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
