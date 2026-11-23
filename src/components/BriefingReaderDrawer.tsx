'use client'

import { useEffect, useRef } from 'react'
import { ArrowRight, BookOpen, CheckCircle2, X } from 'lucide-react'
import { KNOWLEDGE_BRIEFINGS } from '../data/knowledgeBriefings'
import { useLocalization } from '../context/LocalizationContext'

export interface BriefingReaderDrawerProps {
  activeIndex: number | null
  onClose: () => void
  onSelectIndex: (index: number) => void
}

export default function BriefingReaderDrawer({
  activeIndex,
  onClose,
  onSelectIndex,
}: BriefingReaderDrawerProps) {
  const { ui, t, fixtures } = useLocalization()
  const scrollBodyRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  const isOpen =
    activeIndex !== null &&
    activeIndex >= 0 &&
    activeIndex < KNOWLEDGE_BRIEFINGS.length

  // Lock body scroll & wire Escape key while drawer is open
  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    // Move focus to close button for accessibility
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  // Reset reading scroll position when cycling to another briefing
  useEffect(() => {
    if (isOpen && scrollBodyRef.current) {
      scrollBodyRef.current.scrollTop = 0
    }
  }, [activeIndex, isOpen])

  if (!isOpen || activeIndex === null) return null

  const briefing = KNOWLEDGE_BRIEFINGS[activeIndex]
  const localizedMeta = fixtures.insights[activeIndex]
  const nextIndex = (activeIndex + 1) % KNOWLEDGE_BRIEFINGS.length
  const nextBriefing = KNOWLEDGE_BRIEFINGS[nextIndex]

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-reader-title"
    >
      {/* Translucent Backdrop */}
      <div
        className="fixed inset-0 bg-ink/65 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Classic Editorial Slide-Over Reader Panel */}
      <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-ink/15 bg-paper text-ink shadow-2xl">
        {/* Sticky Top Header */}
        <div className="flex items-center justify-between gap-4 border-b border-ink/10 bg-paper-2/90 px-5 py-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-ochre/25 bg-ochre/10 px-2.5 py-1 font-semibold text-ochre">
              <BookOpen size={12} />
              {localizedMeta?.tag ?? briefing.category}
            </span>
            <span className="text-stone">·</span>
            <span className="text-stone">
              {t('home.insights.minRead', { minutes: briefing.minutes })}
            </span>
            <span className="text-stone">·</span>
            <span className="text-ink/60">
              {briefing.number} / 0{KNOWLEDGE_BRIEFINGS.length}
            </span>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={ui('Close briefing', 'Funga muhtasari', 'Cerrar informe')}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink/15 bg-paper text-ink transition hover:border-ink/35 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ochre"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Editorial Article Body */}
        <div
          ref={scrollBodyRef}
          className="flex-1 overflow-y-auto px-5 py-7 sm:px-9 sm:py-9"
        >
          <div className="font-display text-5xl font-light leading-none text-ink/12">
            {briefing.number}
          </div>

          <h2
            id="briefing-reader-title"
            className="font-display mt-3 text-3xl font-normal leading-[1.12] text-ink sm:text-4xl"
          >
            {briefing.title}
          </h2>

          <p className="mt-4 border-b border-ink/10 pb-6 text-base leading-relaxed text-stone sm:text-[17px]">
            {briefing.lead}
          </p>

          {/* Structured Editorial Sections */}
          <div className="mt-7 space-y-7">
            {briefing.sections.map((section) => (
              <section key={section.heading}>
                <h3 className="font-display text-xl font-medium leading-snug text-ink sm:text-2xl">
                  {section.heading}
                </h3>

                <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink/85 sm:text-[15px]">
                  {section.paragraphs.map((para, pIdx) => (
                    <p key={pIdx}>{para}</p>
                  ))}
                </div>

                {section.bullets && (
                  <ul className="mt-3.5 space-y-2.5 text-sm leading-relaxed text-ink/85 sm:text-[15px]">
                    {section.bullets.map((bullet, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2.5">
                        <span
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ochre"
                          aria-hidden="true"
                        />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.table && (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-ink/12 bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-ink/10 bg-paper-2/70 font-mono text-[10px] uppercase tracking-wider text-stone">
                        <tr>
                          {section.table.headers.map((header) => (
                            <th key={header} className="px-3.5 py-2.5 font-semibold">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink/10">
                        {section.table.rows.map((row) => (
                          <tr key={row.licence} className="align-top">
                            <td className="whitespace-nowrap px-3.5 py-3 font-mono font-bold text-ochre">
                              {row.licence}
                            </td>
                            <td className="px-3.5 py-3 text-ink/85">{row.permitted}</td>
                            <td className="px-3.5 py-3 text-stone">{row.scaleTenure}</td>
                            <td className="px-3.5 py-3 text-ink/85">{row.transferRule}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Key Practical Takeaways Summary Box */}
          <div className="mt-8 rounded-xl border border-moss/30 bg-moss-light/65 p-5 sm:p-6">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-moss">
              {ui(
                'Key Practical Takeaways',
                'Mambo Muhimu ya Kuzingatia',
                'Conclusiones Prácticas Clave',
              )}
            </div>
            <ul className="mt-3.5 space-y-2.5 text-sm leading-relaxed text-ink">
              {briefing.takeaways.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-moss" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Regulatory / Editorial Note */}
          <p className="mt-6 border-t border-ink/10 pt-5 text-xs leading-relaxed text-stone">
            {briefing.note}
          </p>
        </div>

        {/* Sticky Bottom Briefing Switcher Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 bg-paper-2/90 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-1.5" aria-label="Briefing navigation">
            {KNOWLEDGE_BRIEFINGS.map((item, idx) => {
              const selected = idx === activeIndex
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectIndex(idx)}
                  aria-current={selected ? 'true' : undefined}
                  className={`rounded-md px-2.5 py-1.5 font-mono text-xs font-semibold transition ${
                    selected
                      ? 'bg-ink text-gold'
                      : 'border border-ink/12 bg-paper text-stone hover:border-ink/30 hover:text-ink'
                  }`}
                >
                  {item.number}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => onSelectIndex(nextIndex)}
            className="inline-flex items-center gap-1.5 rounded-md bg-ink px-4 py-2 text-xs font-semibold text-paper transition hover:bg-ochre sm:text-sm"
          >
            <span>
              {ui('Next briefing', 'Muhtasari unaofuata', 'Siguiente informe')} ({nextBriefing.number})
            </span>
            <ArrowRight size={14} />
          </button>
        </div>
      </aside>
    </div>
  )
}
