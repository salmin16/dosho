import {
  HeadContent,
  Outlet,
  createRootRoute,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import Header from '../components/Header'
import Footer from '../components/Footer'
import CookieConsentBanner from '../components/CookieConsentBanner'
import { LocalizationProvider } from '../context/LocalizationContext'
import { MarketDataProvider } from '../context/MarketDataContext'
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
      <MarketDataProvider>
        <HeadContent />
        <Chrome>
          <Outlet />
        </Chrome>
      </MarketDataProvider>
    </LocalizationProvider>
  )
}

function Chrome({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { session, passwordRecovery, loading: authLoading } = useAuthState()
  const currentUserIdRef = useRef<string | null>(session?.user.id ?? null)
  const currentUserId = session?.user.id ?? null

  useEffect(() => {
    currentUserIdRef.current = currentUserId
  }, [currentUserId])

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
  // Depend on primitive `currentUserId` so background token refreshes for the same user never re-trigger navigation.
  useEffect(() => {
    if (authLoading) return
    if (!isHome && !isMarketsPage && !isMapPage && !isLegalPage && !isAuthPage && !isAdminPage && !currentUserId) {
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
  }, [authLoading, isHome, isMarketsPage, isMapPage, isLegalPage, isAuthPage, isAdminPage, normalizedPath, navigate, currentUserId])

  // NEVER key <Header>, <main>, or <Footer> by currency, FX rate, or language:
  // React Context & MarketDataProvider update price/currency/label nodes in place
  // without ever unmounting dashboards, forms, charts, or active tab selections.
  return (
    <div className="flex min-h-[100dvh] w-full flex-col overflow-x-hidden">
      <Header overlay={isHome} />
      <main className="w-full min-w-0 flex-1">
        {children}
      </main>
      <Footer />
      <CookieConsentBanner />
    </div>
  )
}
