'use client'

import { LocalizationProvider } from '@/context/LocalizationContext'
import MineralPricesBoard from '@/components/MineralPricesBoard'

export default function NextMarketsPage() {
  return (
    <LocalizationProvider>
      <div className="min-h-screen bg-paper text-ink">
        <MineralPricesBoard showHeaderCta={false} />
      </div>
    </LocalizationProvider>
  )
}
