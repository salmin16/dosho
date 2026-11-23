import { Link } from '@tanstack/react-router'
import { Cookie } from 'lucide-react'
import { Logo } from './Header'
import { openCookieSettings } from './CookieConsentBanner'
import { useI18n, type TranslationKey } from '../i18n'

const COLS: {
  titleKey: TranslationKey
  links: { to: string; hash?: string; labelKey: TranslationKey }[]
}[] = [
  {
    titleKey: 'footer.marketplace',
    links: [
      { to: '/opportunities', labelKey: 'footer.miningOpportunities' },
      { to: '/map', labelKey: 'footer.intelligenceMap' },
      { to: '/services', labelKey: 'footer.miningServices' },
      { to: '/list-a-project', labelKey: 'footer.listProject' },
    ],
  },
  {
    titleKey: 'footer.platform',
    links: [
      { to: '/verification', labelKey: 'footer.verificationFramework' },
      { to: '/pricing', labelKey: 'footer.membershipPricing' },
      { to: '/faq', labelKey: 'footer.faq' },
      { to: '/', hash: 'how-it-works', labelKey: 'footer.howItWorks' },
    ],
  },
]

const LEGAL_KEYS: TranslationKey[] = [
  'footer.termsOfUse',
  'footer.privacyPolicy',
  'footer.listingAgreement',
  'footer.investorTerms',
  'footer.facilitationTerms',
  'footer.prohibitedClaims',
  'footer.complaintsProcedure',
]

export default function Footer() {
  const { t } = useI18n()

  return (
    <footer className="surface-texture-dark relative overflow-hidden border-t border-white/[0.09] bg-[#11161D] text-[#94A3B8]">
      <div className="contours absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-5 pb-10 pt-20 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo light />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#94A3B8]">{t('footer.tagline')}</p>
            <p className="eyebrow mt-8 text-[#D4A52E]">{t('footer.motto')}</p>
          </div>

          {COLS.map((c) => (
            <div key={c.titleKey}>
              <h3 className="eyebrow mb-5 text-[#94A3B8]/80">{t(c.titleKey)}</h3>
              <ul className="space-y-3 text-sm text-[#F1F5F9]/85">
                {c.links.map((l) => (
                  <li key={l.labelKey}>
                    <Link to={l.to} hash={l.hash} className="link-underline hover:text-[#F1F5F9]">
                      {t(l.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="eyebrow mb-5 text-[#94A3B8]/80">{t('footer.legalPolicies')}</h3>
            <ul className="space-y-2.5 text-sm">
              {LEGAL_KEYS.map((k) => (
                <li key={k} className="text-[#94A3B8]">
                  {t(k)}
                </li>
              ))}
              <li className="pt-1">
                <button
                  type="button"
                  onClick={openCookieSettings}
                  className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[#D4A52E] transition duration-150 hover:text-[#F1F5F9]"
                >
                  <Cookie size={14} />
                  Cookie Settings
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="panel-dark mt-16 p-6 text-xs leading-relaxed text-[#94A3B8]">
          <strong className="text-[#F1F5F9]">{t('footer.noticeTitle')}</strong> {t('footer.noticeBody')}
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-white/[0.09] pt-6 text-xs text-[#94A3B8] sm:flex-row sm:items-center">
          <span>{t('footer.copyright')}</span>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={openCookieSettings}
              className="inline-flex min-h-[44px] items-center gap-1.5 font-medium text-[#F1F5F9]/80 transition duration-150 hover:text-[#D4A52E]"
            >
              <Cookie size={13} />
              Cookie Settings
            </button>
            <span className="font-mono text-[#94A3B8]">{t('footer.pilotBadge')}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
