import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { LANGUAGES, useI18n, type LanguageCode } from '../i18n'

export default function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const selectLanguage = (code: LanguageCode) => {
    setLang(code)
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('nav.selectLanguage')}: ${current.label}`}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ochre ${
          dark
            ? 'border-paper/20 bg-paper/[0.06] text-paper hover:border-paper/40 hover:bg-paper/10'
            : 'border-ink/15 bg-white/60 text-ink hover:border-ink/35 hover:bg-white'
        }`}
      >
        <Globe size={14} className={dark ? 'text-gold' : 'text-ochre'} aria-hidden />
        <span>{current.label}</span>
        <ChevronDown
          size={13}
          className={` opacity-70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('nav.selectLanguage')}
          className="absolute right-0 top-full z-50 mt-2 min-w-[150px] overflow-hidden rounded-lg border border-ink/15 bg-paper py-1 text-ink shadow-xl"
        >
          {LANGUAGES.map((l) => {
            const active = l.code === lang
            return (
              <li key={l.code} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => selectLanguage(l.code)}
                  className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm transition ${
                    active ? 'bg-ochre/10 font-semibold text-ochre' : 'text-ink hover:bg-ink/5'
                  }`}
                >
                  <span>{l.label}</span>
                  {active && <Check size={14} className="shrink-0 text-ochre" aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
