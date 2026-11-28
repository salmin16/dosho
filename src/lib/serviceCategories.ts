import type { ServiceProvider } from '../data/fixtures'
import { TANZANIA_REGION_LIST } from '../data/tanzaniaDistricts'
import type { UserServiceRecord } from '../types/database'

export const SERVICE_FILTER_CATEGORIES = [
  'Geology & Exploration',
  'Laboratories & Assay',
  'Drilling & Blasting',
  'Surveying & GIS',
  'Environmental & Social',
  'Legal & Advisory',
  'Equipment & Suppliers',
  'Processing & Metallurgy',
  'Others',
] as const

export type ServiceFilterCategory = (typeof SERVICE_FILTER_CATEGORIES)[number]
export type ServiceCategorySelection = 'ALL' | ServiceFilterCategory

export const SERVICE_VERIFICATION_TIERS = [
  { value: 'ALL', label: 'All Tiers', minLevel: 0 },
  { value: 'L1', label: 'L1+ Verified', minLevel: 1 },
  { value: 'L2', label: 'L2+ Licensed', minLevel: 2 },
  { value: 'L3', label: 'L3+ Technical', minLevel: 3 },
  { value: 'L4', label: 'L4 Site Vetted', minLevel: 4 },
] as const

export type ServiceVerificationFilter = (typeof SERVICE_VERIFICATION_TIERS)[number]['value']

export const SERVICE_RATE_MODELS = [
  { value: 'ALL', label: 'All Rate Models' },
  { value: 'day-rate', label: 'Day Rate' },
  { value: 'unit-rate', label: 'Per-Meter / Unit Rate' },
  { value: 'fixed-project', label: 'Fixed Project' },
  { value: 'sla-retainer', label: 'SLA Retainer' },
  { value: 'rfq-custom', label: 'RFQ / Custom' },
] as const

export type ServiceRateModelFilter = (typeof SERVICE_RATE_MODELS)[number]['value']
export type ServiceRateModelKey = Exclude<ServiceRateModelFilter, 'ALL'>

export const SERVICE_REGION_OPTIONS = [
  'ALL',
  'NATIONWIDE',
  ...TANZANIA_REGION_LIST,
] as const

export function getRateModelLabel(key: ServiceRateModelKey): string {
  const found = SERVICE_RATE_MODELS.find((m) => m.value === key)
  return found ? found.label : 'RFQ / Custom'
}

/**
 * Extracts a clean custom category specification when a service
 * was published under "Others".
 */
export function getServiceCustomCategory(
  srv: Pick<UserServiceRecord, 'expertise_area' | 'structured_details'>,
): string | null {
  const details =
    srv.structured_details && typeof srv.structured_details === 'object'
      ? (srv.structured_details as Record<string, unknown>)
      : null
  const custom =
    typeof details?.customCategory === 'string'
      ? details.customCategory.trim()
      : ''
  return custom || null
}

/**
 * Returns true if the service belongs to the "Others" category
 * (including records stored via fallback while migration propagates).
 */
export function isOthersService(
  srv: Pick<UserServiceRecord, 'expertise_area' | 'structured_details'>,
): boolean {
  if (srv.expertise_area === 'Others') return true
  const details =
    srv.structured_details && typeof srv.structured_details === 'object'
      ? (srv.structured_details as Record<string, unknown>)
      : null
  return details?.disciplineLabel === 'Others' || Boolean(getServiceCustomCategory(srv))
}

/**
 * Formats a service's display category cleanly across the Services Directory,
 * User Dashboard, Service Wizard History, Dossier Modal, and Admin Review Queue.
 */
export function formatServiceCategory(
  srv: Pick<UserServiceRecord, 'expertise_area' | 'structured_details'>,
): string {
  const custom = getServiceCustomCategory(srv)
  if (isOthersService(srv)) {
    return custom ? `Others · ${custom}` : 'Others'
  }
  const details =
    srv.structured_details && typeof srv.structured_details === 'object'
      ? (srv.structured_details as Record<string, unknown>)
      : null
  if (typeof details?.disciplineLabel === 'string' && details.disciplineLabel.trim()) {
    return details.disciplineLabel.trim()
  }
  return srv.expertise_area
}

/**
 * Normalizes legacy URL category params (e.g. "Laboratories" or "Geology & exploration")
 * to canonical ServiceCategorySelection values.
 */
export function normalizeServiceCategoryParam(raw?: string | null): ServiceCategorySelection {
  if (!raw) return 'ALL'
  const lower = raw.trim().toLowerCase()
  if (!lower || lower === 'all' || lower === 'all services') return 'ALL'
  if (lower.includes('geolog') || lower.includes('explor')) return 'Geology & Exploration'
  if (lower.includes('laborator') || lower.includes('assay')) return 'Laboratories & Assay'
  if (lower.includes('drill') || lower.includes('blast') || lower.includes('core')) return 'Drilling & Blasting'
  if (lower.includes('survey') || lower.includes('gis')) return 'Surveying & GIS'
  if (lower.includes('environ') || lower.includes('esia') || lower.includes('esg') || lower.includes('social')) {
    return 'Environmental & Social'
  }
  if (lower.includes('legal') || lower.includes('advis') || lower.includes('licen') || lower.includes('cadastre')) {
    return 'Legal & Advisory'
  }
  if (lower.includes('equip') || lower.includes('suppl') || lower.includes('plant & equipment')) {
    return 'Equipment & Suppliers'
  }
  if (lower.includes('process') || lower.includes('metallurg') || lower.includes('epcm')) {
    return 'Processing & Metallurgy'
  }
  if (lower.includes('other')) return 'Others'
  return 'ALL'
}

export function resolveProviderCategory(
  provider: Pick<ServiceProvider, 'category'>,
): ServiceFilterCategory {
  const normalized = normalizeServiceCategoryParam(provider.category)
  return normalized === 'ALL' ? 'Others' : normalized
}

export function resolveLiveServiceCategory(
  srv: Pick<UserServiceRecord, 'expertise_area' | 'structured_details'>,
): ServiceFilterCategory {
  if (isOthersService(srv)) return 'Others'
  const details =
    srv.structured_details && typeof srv.structured_details === 'object'
      ? (srv.structured_details as Record<string, unknown>)
      : null
  const label = typeof details?.disciplineLabel === 'string' ? details.disciplineLabel : ''
  const combined = `${label} ${srv.expertise_area}`.toLowerCase()

  if (combined.includes('geolog') || combined.includes('explor')) return 'Geology & Exploration'
  if (combined.includes('assay') || combined.includes('laborator')) return 'Laboratories & Assay'
  if (combined.includes('drill') || combined.includes('blast') || combined.includes('core')) {
    return 'Drilling & Blasting'
  }
  if (combined.includes('survey') || combined.includes('gis')) return 'Surveying & GIS'
  if (combined.includes('esia') || combined.includes('environ') || combined.includes('esg')) {
    return 'Environmental & Social'
  }
  if (combined.includes('legal') || combined.includes('licens') || combined.includes('cadastre')) {
    return 'Legal & Advisory'
  }
  if (combined.includes('equip') || combined.includes('suppl')) return 'Equipment & Suppliers'
  if (combined.includes('metallurg') || combined.includes('process') || combined.includes('epcm')) {
    return 'Processing & Metallurgy'
  }
  return 'Others'
}

export function getProviderVerificationTier(provider: ServiceProvider): 0 | 1 | 2 | 3 | 4 {
  if (typeof provider.verificationTier === 'number') return provider.verificationTier
  if (!provider.verified) return 0
  if (provider.reviews >= 50) return 4
  if (provider.reviews >= 30) return 3
  if (provider.reviews >= 15) return 2
  return 1
}

export function getLiveServiceVerificationTier(srv: UserServiceRecord): 0 | 1 | 2 | 3 | 4 {
  if (!srv.approved && srv.status !== 'active') return 0
  const certs = `${srv.certifications || ''}`.toLowerCase()
  const hasAttachments = Array.isArray(srv.attachments) && srv.attachments.length > 0
  if (srv.is_featured && (certs.includes('iso') || certs.includes('mining commission'))) return 4
  if (certs.includes('iso') || certs.includes('erb') || certs.includes('nemc')) return 3
  if (certs.includes('mining commission') || hasAttachments) return 2
  return 1
}

export function getProviderRateModel(provider: ServiceProvider): ServiceRateModelKey {
  if (provider.rateModel) return provider.rateModel
  const cat = resolveProviderCategory(provider)
  switch (cat) {
    case 'Geology & Exploration':
    case 'Equipment & Suppliers':
      return 'day-rate'
    case 'Laboratories & Assay':
    case 'Drilling & Blasting':
      return 'unit-rate'
    case 'Surveying & GIS':
    case 'Environmental & Social':
      return 'fixed-project'
    case 'Legal & Advisory':
      return 'sla-retainer'
    default:
      return 'rfq-custom'
  }
}

export function getLiveServiceRateModel(srv: UserServiceRecord): ServiceRateModelKey {
  const details =
    srv.structured_details && typeof srv.structured_details === 'object'
      ? (srv.structured_details as Record<string, unknown>)
      : null
  const raw = `${typeof details?.pricingModel === 'string' ? details.pricingModel : ''} ${srv.rate_or_pricing_model || ''}`.toLowerCase()
  if (raw.includes('day') || raw.includes('daily') || raw.includes('monthly')) return 'day-rate'
  if (raw.includes('meter') || raw.includes('metre') || raw.includes('sample') || raw.includes('unit')) {
    return 'unit-rate'
  }
  if (raw.includes('fixed')) return 'fixed-project'
  if (raw.includes('retainer') || raw.includes('sla')) return 'sla-retainer'
  return 'rfq-custom'
}

export function isProviderNationwide(provider: ServiceProvider): boolean {
  if (provider.nationwide) return true
  const regions = provider.mobilizationRegions ?? []
  return regions.length >= 10
}

export function isLiveServiceNationwide(srv: UserServiceRecord): boolean {
  const cov = (srv.regional_coverage || '').toLowerCase()
  if (cov.includes('all tanzania') || cov.includes('nationwide') || cov.includes('31 mikoa')) {
    return true
  }
  const details =
    srv.structured_details && typeof srv.structured_details === 'object'
      ? (srv.structured_details as Record<string, unknown>)
      : null
  const regions = Array.isArray(details?.coverageRegions) ? details.coverageRegions : []
  return regions.length >= 10
}

export interface ServicesFilterState {
  q: string
  category: ServiceCategorySelection
  region: string
  verification: ServiceVerificationFilter
  rateModel: ServiceRateModelFilter
}

export const DEFAULT_SERVICES_FILTER: ServicesFilterState = {
  q: '',
  category: 'ALL',
  region: 'ALL',
  verification: 'ALL',
  rateModel: 'ALL',
}

function minLevelForTier(tier: ServiceVerificationFilter): number {
  const found = SERVICE_VERIFICATION_TIERS.find((t) => t.value === tier)
  return found ? found.minLevel : 0
}

export function matchesProviderFilters(
  provider: ServiceProvider,
  filters: ServicesFilterState,
): boolean {
  if (filters.category !== 'ALL' && resolveProviderCategory(provider) !== filters.category) {
    return false
  }

  const minLevel = minLevelForTier(filters.verification)
  if (minLevel > 0 && getProviderVerificationTier(provider) < minLevel) {
    return false
  }

  if (filters.rateModel !== 'ALL' && getProviderRateModel(provider) !== filters.rateModel) {
    return false
  }

  if (filters.region !== 'ALL') {
    if (filters.region === 'NATIONWIDE') {
      if (!isProviderNationwide(provider)) return false
    } else {
      const target = filters.region.toLowerCase()
      const regionHaystack = [
        provider.location,
        ...(provider.mobilizationRegions ?? []),
      ]
        .join(' ')
        .toLowerCase()
      if (!regionHaystack.includes(target) && !isProviderNationwide(provider)) {
        return false
      }
    }
  }

  const q = filters.q.trim().toLowerCase()
  if (q) {
    const haystack = [
      provider.name,
      provider.category,
      resolveProviderCategory(provider),
      provider.location,
      ...(provider.mobilizationRegions ?? []),
      provider.summary,
      ...provider.services,
      ...(provider.certifications ?? []),
      getRateModelLabel(getProviderRateModel(provider)),
    ]
      .join(' ')
      .toLowerCase()
    if (!haystack.includes(q)) return false
  }

  return true
}

export function matchesLiveServiceFilters(
  srv: UserServiceRecord,
  filters: ServicesFilterState,
): boolean {
  if (filters.category !== 'ALL') {
    if (filters.category === 'Others') {
      if (!isOthersService(srv)) return false
    } else if (resolveLiveServiceCategory(srv) !== filters.category) {
      return false
    }
  }

  const minLevel = minLevelForTier(filters.verification)
  if (minLevel > 0 && getLiveServiceVerificationTier(srv) < minLevel) {
    return false
  }

  if (filters.rateModel !== 'ALL' && getLiveServiceRateModel(srv) !== filters.rateModel) {
    return false
  }

  if (filters.region !== 'ALL') {
    if (filters.region === 'NATIONWIDE') {
      if (!isLiveServiceNationwide(srv)) return false
    } else {
      const target = filters.region.toLowerCase()
      const cov = (srv.regional_coverage || '').toLowerCase()
      if (!cov.includes(target) && !isLiveServiceNationwide(srv)) {
        return false
      }
    }
  }

  const q = filters.q.trim().toLowerCase()
  if (q) {
    const details =
      srv.structured_details && typeof srv.structured_details === 'object'
        ? (srv.structured_details as Record<string, unknown>)
        : null
    const haystack = [
      srv.service_name,
      srv.provider_organization,
      srv.expertise_area,
      formatServiceCategory(srv),
      srv.regional_coverage,
      srv.certifications,
      srv.scope_description,
      srv.rate_or_pricing_model,
      srv.reference_code,
      typeof details?.equipmentStandards === 'string' ? details.equipmentStandards : '',
    ]
      .join(' ')
      .toLowerCase()
    if (!haystack.includes(q)) return false
  }

  return true
}
