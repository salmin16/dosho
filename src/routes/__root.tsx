import {
  HeadContent,
  Outlet,
  createRootRoute,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import CookieConsentBanner from '../components/CookieConsentBanner'
import { LocalizationProvider, useLocalization } from '../context/LocalizationContext'
import { useAuthState } from '../lib/supabaseAuth'

import '../styles.css'

const siteName = 'MineConnect — Discover. Verify. Connect. Tanzania’s mining opportunity marketplace'
const siteDescription =
  'MineConnect connects Tanzanian miners and mineral-right holders with investors, mining companies and professional service providers through verified listings, map-based discovery and structured due diligence.'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        title: siteName,
      },
      {
        name: 'description',
        content: siteDescription,
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <LocalizationProvider>
      <HeadContent />
      <Chrome>
        <Outlet />
      </Chrome>
    </LocalizationProvider>
  )
}

function Chrome({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { session, passwordRecovery, loading: authLoading } = useAuthState()
  // Subscribe Chrome & child routes to active currency AND language changes so all formatting and translation calls re-render immediately
  const { currency, rateForSelected, lang } = useLocalization()

  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const normalizedPath =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || '/'
      : pathname

  const isHome = normalizedPath === '/' || normalizedPath === ''
  const isMarketsPage =
    normalizedPath === '/markets' || normalizedPath.startsWith('/markets/')
  const isMapPage =
    normalizedPath === '/map' || normalizedPath.startsWith('/map/')
  const isLegalPage =
    normalizedPath === '/legal' || normalizedPath.startsWith('/legal/')
  const isAdminPage =
    normalizedPath === '/admin' || normalizedPath.startsWith('/admin/')
  const isResetPasswordPage =
    normalizedPath === '/reset-password' ||
    normalizedPath.startsWith('/reset-password/')
  const isAuthPage =
    normalizedPath === '/login' ||
    normalizedPath === '/signup' ||
    isResetPasswordPage ||
    normalizedPath.startsWith('/login/') ||
    normalizedPath.startsWith('/signup/')

  // Global Supabase PASSWORD_RECOVERY catch: if Supabase redirects to `/` or any page
  // with a recovery hash/query or fires PASSWORD_RECOVERY, route straight to `/reset-password`
  // while preserving any recovery query/hash tokens for immediate exchange & scrubbing.
  useEffect(() => {
    if (isResetPasswordPage) return
    const hasRecoveryUrl =
      typeof window !== 'undefined' &&
      (window.location.hash.includes('type=recovery') ||
        new URLSearchParams(window.location.search).get('type') === 'recovery')

    if (hasRecoveryUrl) {
      window.location.replace(
        `/reset-password${window.location.search}${window.location.hash}`
      )
      return
    }

    if (passwordRecovery) {
      navigate({ to: '/reset-password', replace: true })
    }
  }, [isResetPasswordPage, navigate, passwordRecovery])

  // Strict Mandatory Membership Guard:
  // Wait for Supabase Auth hydration before enforcing redirect so authenticated users never bounce.
  useEffect(() => {
    if (authLoading) return
    if (!isHome && !isMarketsPage && !isMapPage && !isLegalPage && !isAuthPage && !isAdminPage && !session) {
      navigate({
        to: '/signup',
        search: {
          next: normalizedPath,
          reason:
            normalizedPath === '/list-a-project'
              ? 'list_project'
              : normalizedPath === '/services'
                ? 'request_quote'
                : 'membership_required',
        } as unknown as undefined,
      })
    }
  }, [authLoading, isHome, isMarketsPage, isMapPage, isLegalPage, isAuthPage, isAdminPage, normalizedPath, navigate, session])

  return (
    <div data-currency={currency} data-fx-rate={rateForSelected} data-lang={lang}>
      <Header overlay={isHome} key={isHome ? `home-${currency}-${lang}` : `page-${currency}-${lang}`} />
      <main key={`${currency}-${rateForSelected}-${lang}`}>{children}</main>
      <Footer key={`footer-${currency}-${lang}`} />
      <CookieConsentBanner />
    </div>
  )
}
