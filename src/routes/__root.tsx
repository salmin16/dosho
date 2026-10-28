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
import { LanguageProvider } from '../i18n'
import { CurrencyProvider, useCurrency } from '../lib/currency'
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
    <CurrencyProvider>
      <LanguageProvider>
        <HeadContent />
        <Chrome>
          <Outlet />
        </Chrome>
      </LanguageProvider>
    </CurrencyProvider>
  )
}

function Chrome({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const session = useAuthSession()
  // Subscribe Chrome & child routes to active currency changes so all `formatUsd` calls re-render immediately
  const { currency, rateForSelected } = useCurrency()

  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const normalizedPath =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || '/'
      : pathname

  const isHome = normalizedPath === '/' || normalizedPath === ''
  const isAuthPage =
    normalizedPath === '/login' ||
    normalizedPath === '/signup' ||
    normalizedPath.startsWith('/login/') ||
    normalizedPath.startsWith('/signup/')

  // Strict Mandatory Membership Guard:
  // Unauthenticated visitors may only view the public Landing Page (`/`) and Auth Pages (`/login`, `/signup`).
  useEffect(() => {
    const activeSession = getSession()
    if (!isHome && !isAuthPage && !activeSession) {
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
  }, [isHome, isAuthPage, normalizedPath, navigate, session])

  return (
    <div data-currency={currency} data-fx-rate={rateForSelected}>
      <Header overlay={isHome} key={isHome ? `home-${currency}` : `page-${currency}`} />
      <main key={`${currency}-${rateForSelected}`}>{children}</main>
      <Footer key={`footer-${currency}`} />
    </div>
  )
}
