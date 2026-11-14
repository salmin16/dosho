import React from 'react'
import { LocalizationProvider } from '@/context/LocalizationContext'
import '../styles.css'

export const metadata = {
  title: 'MineConnect — Discover. Verify. Connect. Tanzania’s mining opportunity marketplace',
  description:
    'MineConnect connects Tanzanian miners and mineral-right holders with investors, mining companies and professional service providers through verified listings, map-based discovery and structured due diligence.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink antialiased">
        <LocalizationProvider>{children}</LocalizationProvider>
      </body>
    </html>
  )
}
