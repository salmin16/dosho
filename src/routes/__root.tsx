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
import { LocalizationProvider, useLocalization } from '../context/LocalizationContext'
import { getSession, useAuthSession } from '../lib/supabaseAuth'

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
  const session = useAuthSession()
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
  const isAdminPage =
    normalizedPath === '/admin' || normalizedPath.startsWith('/admin/')
  const isAuthPage =
    normalizedPath === '/login' ||
    normalizedPath === '/signup' ||
    normalizedPath.startsWith('/login/') ||
    normalizedPath.startsWith('/signup/')

  // Strict Mandatory Membership Guard:
  // Unauthenticated visitors may only view the public Landing Page (`/`), Markets Board (`/markets`), Regional GIS Map (`/map`), Auth Pages (`/login`, `/signup`), and `/admin` (which enforces its own RBAC guard).
  useEffect(() => {
    const activeSession = getSession()
    if (!isHome && !isMarketsPage && !isMapPage && !isAuthPage && !isAdminPage && !activeSession) {
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
  }, [isHome, isMarketsPage, isMapPage, isAuthPage, isAdminPage, normalizedPath, navigate, session])

  return (
    <div data-currency={currency} data-fx-rate={rateForSelected} data-lang={lang}>
      <Header overlay={isHome} key={isHome ? `home-${currency}-${lang}` : `page-${currency}-${lang}`} />
      <main key={`${currency}-${rateForSelected}-${lang}`}>{children}</main>
      <Footer key={`footer-${currency}-${lang}`} />
    </div>
  )
}
