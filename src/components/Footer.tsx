import { Link } from '@tanstack/react-router'
import { Logo } from './Header'
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
    <footer className="relative overflow-hidden bg-ink text-paper/80">
      <div className="contours absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-5 pb-10 pt-20 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo light />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-paper/60">{t('footer.tagline')}</p>
            <p className="eyebrow mt-8 text-gold">{t('footer.motto')}</p>
          </div>

          {COLS.map((c) => (
            <div key={c.titleKey}>
              <h3 className="eyebrow mb-5 text-paper/40">{t(c.titleKey)}</h3>
              <ul className="space-y-3 text-sm">
                {c.links.map((l) => (
                  <li key={l.labelKey}>
                    <Link to={l.to} hash={l.hash} className="link-underline hover:text-paper">
                      {t(l.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="eyebrow mb-5 text-paper/40">{t('footer.legalPolicies')}</h3>
            <ul className="space-y-2.5 text-sm">
              {LEGAL_KEYS.map((k) => (
                <li key={k} className="text-paper/60">
                  {t(k)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 rounded-lg border border-paper/10 bg-paper/[0.03] p-5 text-xs leading-relaxed text-paper/50">
          <strong className="text-paper/70">{t('footer.noticeTitle')}</strong> {t('footer.noticeBody')}
        </div>

        <div className="mt-8 flex flex-col justify-between gap-3 border-t border-paper/10 pt-6 text-xs text-paper/40 sm:flex-row">
          <span>{t('footer.copyright')}</span>
          <span className="font-mono">{t('footer.pilotBadge')}</span>
        </div>
      </div>
    </footer>
  )
}
