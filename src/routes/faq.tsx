import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useI18n } from '../i18n'

export const Route = createFileRoute('/faq')({
  head: () => ({ meta: [{ title: 'FAQ — MineConnect' }] }),
  component: FAQ,
})

function FAQ() {
  const { t, fixtures } = useI18n()
  const groups = fixtures.faqGroups
  const [open, setOpen] = useState<string | null>(groups[0].items[0].id)

  return (
    <div className="pt-[72px]">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 py-16 lg:grid-cols-[320px_1fr] lg:px-8 lg:py-24">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow mb-4 text-ochre">{t('faq.eyebrow')}</p>
          <h1 className="font-display text-5xl font-light leading-none">{t('faq.title')}</h1>
          <p className="mt-5 text-stone">{t('faq.subtitle')}</p>
          <nav className="mt-8 hidden space-y-2 lg:block">
            {groups.map((g) => (
              <a key={g.id} href={`#${g.id}`} className="block text-sm text-stone hover:text-ochre">
                {g.title}
              </a>
            ))}
          </nav>
          <Link to="/list-a-project" className="btn-primary mt-8">
            {t('faq.listBtn')}
          </Link>
        </div>

        <div className="space-y-12">
          {groups.map((g) => (
            <section key={g.id} id={g.id} className="scroll-mt-28">
              <h2 className="eyebrow mb-4 text-stone">{g.title}</h2>
              <div className="divide-y divide-ink/10 border-y border-ink/10">
                {g.items.map((f) => {
                  const isOpen = open === f.id
                  return (
                    <div key={f.id}>
                      <button
                        onClick={() => setOpen(isOpen ? null : f.id)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-6 py-5 text-left"
                      >
                        <span className="font-display text-xl md:text-2xl">{f.q}</span>
                        <ChevronDown size={20} className={`shrink-0 text-ochre transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <div className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr] pb-6' : 'grid-rows-[0fr]'}`}>
                        <p className="overflow-hidden leading-relaxed text-stone">{f.a}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
