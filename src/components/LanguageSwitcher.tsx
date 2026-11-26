import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { LANGUAGES, useI18n, type LanguageCode } from '../i18n'

export interface LanguageSwitcherProps {
  dark?: boolean
  align?: 'left' | 'right'
  fullWidth?: boolean
}

export default function LanguageSwitcher({
  dark = false,
  align = 'right',
  fullWidth = false,
}: LanguageSwitcherProps) {
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
    <div ref={containerRef} className={`relative ${fullWidth ? 'w-full min-w-0' : ''}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('nav.selectLanguage')}: ${current.label}`}
        className={`inline-flex min-h-[44px] sm:min-h-[38px] items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ochre ${
          fullWidth ? 'w-full min-w-0 justify-between text-[11px]' : ''
        } ${
          dark
            ? open
              ? 'border-gold bg-paper/18 text-paper'
              : 'border-paper/20 bg-paper/[0.06] text-paper hover:border-paper/40 hover:bg-paper/10'
            : open
              ? 'border-ochre bg-ochre/10 text-ink'
              : 'border-ink/15 bg-[#FCFBF8] text-ink hover:border-ink/35 hover:bg-paper-2'
        }`}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
          <Globe size={14} className={`shrink-0 ${dark ? 'text-gold' : 'text-ochre'}`} aria-hidden />
          <span className="truncate">{current.label}</span>
        </span>
        <ChevronDown
          size={13}
          className={`shrink-0 opacity-70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('nav.selectLanguage')}
          className={`absolute top-full z-50 mt-2 max-h-64 min-w-[156px] overflow-y-auto rounded-lg border border-ink/15 bg-paper py-1 text-ink shadow-xl ${
            align === 'left'
              ? 'left-0 max-w-[calc(100vw-4rem)]'
              : 'right-0 max-w-[calc(100vw-2rem)]'
          }`}
        >
          {LANGUAGES.map((l) => {
            const active = l.code === lang
            return (
              <li key={l.code} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => selectLanguage(l.code)}
                  className={`flex min-h-[44px] sm:min-h-[38px] w-full items-center justify-between gap-3 border-l-2 px-3.5 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'border-ochre bg-ochre/12 font-semibold text-ochre'
                      : 'border-transparent text-ink hover:bg-ink/5'
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
