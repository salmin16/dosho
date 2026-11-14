'use client'

import { LocalizationProvider } from '@/context/LocalizationContext'
import { DashboardRouteComponent } from '@/routes/dashboard'

export default function NextVaultPage() {
  return (
    <LocalizationProvider>
      <DashboardRouteComponent />
    </LocalizationProvider>
  )
}
