import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Menu, ShieldCheck, User, X } from 'lucide-react'
import { useI18n, type TranslationKey } from '../i18n'
import { useAuthSession } from '../lib/supabaseAuth'
import LanguageSwitcher from './LanguageSwitcher'

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
        <path d="M6 23 L12.5 10 L16 17 L19.5 10 L26 23" fill="none" stroke="#f6f1e7" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="16" cy="23" r="1.9" fill="#d6a443" />
      </svg>
      <span className="font-display text-[1.35rem] font-semibold leading-none">
        Mine<span className="text-ochre">Connect</span>
      </span>
    </span>
  )
}

export default function Header({ overlay = false }: { overlay?: boolean }) {
  const { t } = useI18n()
  const session = useAuthSession()
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
        dark ? 'bg-transparent text-paper' : 'border-b border-ink/10 bg-paper/90 text-ink backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
        <Link to="/" aria-label={t('nav.homeAria')} onClick={() => setOpen(false)} className="shrink-0">
          <Logo light={dark} />
        </Link>

        <nav className="hidden items-center gap-5 xl:gap-8 lg:flex" aria-label={t('nav.mainAria')}>
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="link-underline whitespace-nowrap text-sm font-medium opacity-80 transition hover:opacity-100"
              activeProps={{ className: 'opacity-100 !bg-[length:100%_1px]' }}
            >
              {t(n.key)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {session ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-md border border-ochre/40 bg-ochre/10 px-3 py-2 text-xs font-semibold text-ochre transition hover:bg-ochre/20"
            >
              <ShieldCheck size={14} />
              Vault ({session.user.fullName.split(' ')[0]})
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium opacity-80 hover:opacity-100"
            >
              <User size={15} />
              Sign In
            </Link>
          )}
          <Link to="/list-a-project" className="btn-primary whitespace-nowrap !py-2.5">
            {t('nav.listProject')}
          </Link>
          <LanguageSwitcher dark={dark} />
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <LanguageSwitcher dark={dark} />
          <button
            className="rounded-md p-2"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
            aria-expanded={open}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-ink/10 bg-paper px-5 pb-6 pt-2 text-ink lg:hidden">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className="block border-b border-ink/5 py-3.5 font-display text-xl"
            >
              {t(n.key)}
            </Link>
          ))}
          <Link
            to={session ? '/dashboard' : '/login'}
            onClick={() => setOpen(false)}
            className="block border-b border-ink/5 py-3.5 text-sm font-semibold text-ochre"
          >
            {session ? `Grounded Vault (${session.user.email})` : 'Sign In / Create Account'}
          </Link>
          <Link to="/list-a-project" onClick={() => setOpen(false)} className="btn-primary mt-5 w-full">
            {t('nav.listProject')}
          </Link>
        </div>
      )}
    </header>
  )
}
