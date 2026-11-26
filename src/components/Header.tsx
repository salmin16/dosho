import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Lock, Menu, ShieldCheck, User, X } from 'lucide-react'
import { type TranslationKey } from '../i18n'
import { useLocalization } from '../context/LocalizationContext'
import { useAuthState } from '../lib/supabaseAuth'
import { useSubscription } from '../lib/subscriptions'
import LanguageSwitcher from './LanguageSwitcher'
import CurrencySwitcher from './CurrencySwitcher'

const NAV: { to: string; key: TranslationKey }[] = [
  { to: '/opportunities', key: 'nav.opportunities' },
  { to: '/map', key: 'nav.map' },
  { to: '/services', key: 'nav.services' },
  { to: '/verification', key: 'nav.verification' },
  { to: '/pricing', key: 'nav.pricing' },
]

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 ${light ? 'text-paper' : 'text-ink'}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="7" className="fill-ochre" />
        <path
          d="M6 23 L12.5 10 L16 17 L19.5 10 L26 23"
          fill="none"
          stroke="#f6f1e7"
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="16" cy="23" r="1.9" fill="#d6a443" />
      </svg>
      <span className="font-display text-[1.35rem] font-semibold leading-none">
        Mine<span className="text-ochre">Connect</span>
      </span>
    </span>
  )
}

export default function Header({ overlay = false }: { overlay?: boolean }) {
  const { t, ui } = useLocalization()
  const { session, isAdmin } = useAuthState()
  const { tierName } = useSubscription()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const dark = overlay && !scrolled && !open

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        dark
          ? 'bg-transparent text-paper'
          : 'border-b border-ink/10 bg-paper/90 text-ink backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-5 lg:px-8">
        <Link
          to="/"
          aria-label={t('nav.homeAria')}
          onClick={() => setOpen(false)}
          className="shrink-0"
        >
          <Logo light={dark} />
        </Link>

        <nav
          className="hidden items-center gap-5 xl:gap-7 lg:flex"
          aria-label={t('nav.mainAria')}
        >
          <Link
            to="/markets"
            className={`link-underline flex items-center gap-1 whitespace-nowrap border-b-2 border-transparent py-1 text-sm font-semibold transition-colors ${
              dark ? 'text-gold hover:text-paper' : 'text-ochre hover:text-ochre-dark'
            }`}
            activeProps={{
              className: dark
                ? '!border-gold !text-gold font-bold'
                : '!border-ochre !text-ochre font-bold',
            }}
          >
            {ui('Markets', 'Masoko', 'Mercados')}
          </Link>
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="link-underline flex items-center gap-1 whitespace-nowrap border-b-2 border-transparent py-1 text-sm font-medium opacity-80 transition-colors hover:opacity-100"
              activeProps={{
                className: dark
                  ? '!opacity-100 !border-gold !text-paper font-semibold'
                  : '!opacity-100 !border-ochre !text-ink font-semibold',
              }}
            >
              {!session && <Lock size={11} className="text-gold opacity-80" />}
              {t(n.key)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 lg:flex">
          <CurrencySwitcher dark={dark} />
          <LanguageSwitcher dark={dark} />

          {session ? (
            <>
              <Link
                to="/dashboard"
                title={`${ui('Account', 'Akaunti', 'Cuenta')} (${session.user.fullName.split(' ')[0]} · ${tierName})`}
                className="inline-flex max-w-[210px] items-center gap-1.5 whitespace-nowrap rounded-md border border-gold/50 bg-ochre/20 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-ochre/30 xl:max-w-none"
              >
                <ShieldCheck size={14} className="shrink-0" />
                <span className="truncate">
                  {ui('Account', 'Akaunti', 'Cuenta')} ({session.user.fullName.split(' ')[0]} · {tierName})
                </span>
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-1.5 rounded-md border border-moss/60 bg-moss/25 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-moss/35"
                >
                  <ShieldCheck size={14} />
                  {ui('Admin Dashboard', 'Dashibodi ya Utawala', 'Panel Admin')}
                </Link>
              )}
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-md bg-ochre px-3.5 py-2 text-xs font-semibold text-paper shadow-xs transition hover:bg-ochre-dark"
            >
              <User size={14} />
              {ui('Login', 'Ingia', 'Iniciar sesión')}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <div className="hidden items-center gap-2 sm:flex">
            <CurrencySwitcher dark={dark} />
            <LanguageSwitcher dark={dark} />
          </div>
          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-2 transition hover:bg-current/10"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={open}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <>
          <div
            className="fixed inset-0 top-[72px] z-40 bg-ink/50 backdrop-blur-[2px] lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-label="Mobile Navigation"
            className="relative z-50 max-h-[calc(100dvh-72px)] overflow-y-auto overscroll-contain border-t border-ink/10 bg-paper px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2.5 text-ink shadow-2xl lg:hidden"
          >
            <div className="mb-2 w-full min-w-0 rounded-lg border border-ink/10 bg-paper-2/80 p-2.5 sm:hidden">
              <span className="mb-1.5 block font-mono text-[10px] font-semibold uppercase tracking-wider text-stone">
                {ui('Currency & Language', 'Sarafu na Lugha', 'Moneda e Idioma')}
              </span>
              <div className="grid w-full min-w-0 grid-cols-2 gap-2">
                <div className="min-w-0">
                  <CurrencySwitcher dark={false} align="left" fullWidth />
                </div>
                <div className="min-w-0">
                  <LanguageSwitcher dark={false} align="right" fullWidth />
                </div>
              </div>
            </div>

            <Link
              to="/markets"
              onClick={() => setOpen(false)}
              className="flex min-h-[44px] items-center justify-between border-b border-ink/8 border-l-2 border-l-transparent pl-2 py-2.5 font-display text-[17px] leading-snug text-ink transition-colors hover:text-ochre focus-visible:text-ochre"
              activeProps={{ className: '!border-l-ochre bg-ochre/8 !text-ochre font-semibold' }}
            >
              <span>
                {ui('Indicative Mineral Markets', 'Bei Elekezi za Madini', 'Mercados de Minerales')}
              </span>
            </Link>
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center justify-between border-b border-ink/8 border-l-2 border-l-transparent pl-2 py-2.5 font-display text-[17px] leading-snug text-ink transition-colors hover:text-ochre focus-visible:text-ochre"
                activeProps={{ className: '!border-l-ochre bg-ochre/8 !text-ochre font-semibold' }}
              >
                <span>{t(n.key)}</span>
                {!session && <Lock size={13} className="shrink-0 text-stone" />}
              </Link>
            ))}

            {session ? (
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center gap-2 border-b border-ink/8 border-l-2 border-l-transparent pl-2 py-2.5 text-sm font-semibold text-ink transition-colors hover:text-ochre focus-visible:text-ochre"
                activeProps={{ className: '!border-l-ochre bg-ochre/8 !text-ochre' }}
              >
                <ShieldCheck size={15} className="shrink-0" />
                <span className="truncate">
                  {ui('Account', 'Akaunti', 'Cuenta')} ({session.user.fullName.split(' ')[0]} · {tierName})
                </span>
              </Link>
            ) : (
              <div className="mt-3">
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-md bg-ochre px-4 py-2 text-sm font-semibold text-paper shadow-xs transition-colors hover:bg-ochre-dark"
                >
                  <User size={15} />
                  {ui('Login', 'Ingia', 'Iniciar sesión')}
                </Link>
              </div>
            )}

            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="flex min-h-[44px] items-center gap-2 border-b border-ink/8 pl-2 py-2.5 text-sm font-semibold text-moss"
              >
                <ShieldCheck size={15} className="shrink-0" />
                {ui('Admin Dashboard (/admin)', 'Dashibodi ya Utawala (/admin)', 'Panel Admin (/admin)')}
              </Link>
            )}
          </div>
        </>
      )}
    </header>
  )
}
