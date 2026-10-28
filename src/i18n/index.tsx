import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import en from './locales/en.json'
import sw from './locales/sw.json'
import es from './locales/es.json'
import { getLocalizedFixtures, localizeProject, translateValue } from './fixtures-translations'
import { useCurrency } from '../lib/currency'
import type { Project } from '../data/fixtures'

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'es', label: 'Español' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']
export type TranslationKey = keyof typeof en

const DICTIONARIES: Record<LanguageCode, Record<TranslationKey, string>> = {
  en,
  sw,
  es,
}

const STORAGE_KEY = 'mc:lang'

const DATE_LOCALES: Record<LanguageCode, string> = {
  en: 'en-GB',
  sw: 'sw-TZ',
  es: 'es-ES',
}

function isValidLang(val: unknown): val is LanguageCode {
  return typeof val === 'string' && LANGUAGES.some((l) => l.code === val)
}

interface I18nContextValue {
  lang: LanguageCode
  setLang: (lang: LanguageCode) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  tv: (value: string) => string
  localizeProject: (project: Project) => Project
  formatDate: (iso: string) => string
  fixtures: ReturnType<typeof getLocalizedFixtures>
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>('en')
  // Subscribe LanguageProvider to active currency & exchange rates so all consumers re-render immediately on currency change
  const { currency, rateForSelected, convertText } = useCurrency()

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isValidLang(saved)) {
        setLangState(saved)
        document.documentElement.lang = saved
      }
    } catch {
      // Ignore storage access errors
    }
  }, [])

  const setLang = useCallback((next: LanguageCode) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ignore storage access errors
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next
    }
  }, [])

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const dict = DICTIONARIES[lang] ?? DICTIONARIES.en
      let str = dict[key] ?? DICTIONARIES.en[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replaceAll(`{${k}}`, String(v))
        }
      }
      return convertText(str)
    },
    [lang, currency, rateForSelected, convertText],
  )

  const tv = useCallback(
    (value: string) => convertText(translateValue(value, lang)),
    [lang, currency, rateForSelected, convertText],
  )

  const locProject = useCallback(
    (project: Project) => localizeProject(project, lang),
    [lang, currency, rateForSelected],
  )

  const formatDate = useCallback(
    (iso: string) => {
      try {
        return new Date(iso + 'T00:00:00').toLocaleDateString(DATE_LOCALES[lang], {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      } catch {
        return iso
      }
    },
    [lang],
  )

  const fixtures = useMemo(() => {
    const base = getLocalizedFixtures(lang)
    return {
      ...base,
      opportunityStreams: base.opportunityStreams.map((s) => ({
        ...s,
        typicalValue: convertText(s.typicalValue),
      })),
      plans: base.plans.map((p) => ({
        ...p,
        price: convertText(p.price),
        yearly: 'yearly' in p && p.yearly ? convertText(p.yearly) : undefined,
      })),
      servicesPricing: base.servicesPricing.map((sp) => ({
        ...sp,
        price: convertText(sp.price),
      })),
      listPackages: base.listPackages.map((lp) => ({
        ...lp,
        price: convertText(lp.price),
      })),
    }
  }, [lang, currency, rateForSelected, convertText])

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t,
      tv,
      localizeProject: locProject,
      formatDate,
      fixtures,
    }),
    [lang, setLang, t, tv, locProject, formatDate, fixtures, currency, rateForSelected],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within LanguageProvider')
  }
  return ctx
}
