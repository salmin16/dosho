import { HeadContent, Outlet, createRootRoute, useRouterState } from '@tanstack/react-router'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { LanguageProvider } from '../i18n'

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
    <LanguageProvider>
      <HeadContent />
      <Chrome>
        <Outlet />
      </Chrome>
    </LanguageProvider>
  )
}

function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const isHome = pathname === '/' || pathname === basePath || pathname === `${basePath}/`
  return (
    <>
      <Header overlay={isHome} key={isHome ? 'home' : 'page'} />
      <main>{children}</main>
      <Footer />
    </>
  )
}
