import { HeadContent, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
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
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: siteName,
      },
      {
        name: 'description',
        content: siteDescription,
      },
      {
        property: 'og:title',
        content: siteName,
      },
      {
        property: 'og:description',
        content: siteDescription,
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      { name: 'theme-color', content: '#15120f' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..700,0..100&family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@400;500&display=swap',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <LanguageProvider>
          <Chrome>{children}</Chrome>
        </LanguageProvider>
        <Scripts />
      </body>
    </html>
  )
}

function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  return (
    <>
      <Header overlay={pathname === '/'} key={pathname === '/' ? 'home' : 'page'} />
      <main>{children}</main>
      <Footer />
    </>
  )
}
