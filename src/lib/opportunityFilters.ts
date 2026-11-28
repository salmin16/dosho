import type { Project } from '../data/fixtures'
import { TANZANIA_REGION_LIST } from '../data/tanzaniaDistricts'
import {
  formatOpportunityCategory,
  isOthersOpportunity,
} from './opportunityCategories'
import { normalizeVerificationLevel } from './verificationLevels'
import type { UserListedProject, UserOpportunityRecord } from '../types/database'

export const OPPORTUNITY_FILTER_CATEGORIES = [
  'Joint Venture',
  'Exploration / Mining Tender',
  'Consultancy',
  'Exploration Grant',
  'Offtake / Supply',
  'Internship',
  'Others',
] as const

export type OpportunityFilterCategory = (typeof OPPORTUNITY_FILTER_CATEGORIES)[number]
export type OpportunityCategorySelection = 'ALL' | OpportunityFilterCategory

export const OPPORTUNITY_COMMODITIES = [
  'Gold',
  'Copper',
  'Graphite',
  'Tanzanite',
  'Lithium',
  'Rare Earths',
  'Nickel',
  'Coal',
  'Industrial Minerals',
] as const

export type OpportunityCommodity = (typeof OPPORTUNITY_COMMODITIES)[number]
export type OpportunityCommoditySelection = 'ALL' | OpportunityCommodity

export const OPPORTUNITY_TENEMENT_TYPES = [
  'PML',
  'PL',
  'ML',
  'SML',
  'Processing / Dealer',
  'N/A (Tender / Consultancy)',
] as const

export type OpportunityTenementType = (typeof OPPORTUNITY_TENEMENT_TYPES)[number]
export type OpportunityTenementSelection = 'ALL' | OpportunityTenementType

export const OPPORTUNITY_DEAL_STRUCTURES = [
  'Equity / Farm-In JV',
  'Fixed Budget',
  'BoQ / Competitive Tender',
  'Offtake / Supply',
  'Grant / Co-Funding',
] as const

export type OpportunityDealStructure = (typeof OPPORTUNITY_DEAL_STRUCTURES)[number]
export type OpportunityDealStructureSelection = 'ALL' | OpportunityDealStructure

export const OPPORTUNITY_VERIFICATION_TIERS = [
  { value: 'ALL', label: 'Any Level', minLevel: 0 },
  { value: 'L1', label: 'L1+ Verified ID', minLevel: 1 },
  { value: 'L2', label: 'L2+ Licence Checked', minLevel: 2 },
  { value: 'L3', label: 'L3+ Technical', minLevel: 3 },
  { value: 'L4', label: 'L4 Site Vetted', minLevel: 4 },
] as const

export type OpportunityVerificationSelection =
  (typeof OPPORTUNITY_VERIFICATION_TIERS)[number]['value']

export const OPPORTUNITY_STATUS_OPTIONS = [
  { value: 'open', label: 'Open Only' },
  { value: 'closing-soon', label: 'Closing Soon (≤14 days)' },
  { value: 'all', label: 'All' },
] as const

export type OpportunityStatusSelection =
  (typeof OPPORTUNITY_STATUS_OPTIONS)[number]['value']

export const OPPORTUNITY_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'closing-soonest', label: 'Closing Soonest' },
  { value: 'highest-value', label: 'Highest Value' },
] as const

export type OpportunitySortSelection =
  (typeof OPPORTUNITY_SORT_OPTIONS)[number]['value']

export const OPPORTUNITY_REGIONS = TANZANIA_REGION_LIST

export interface OpportunitiesFilterState {
  q: string
  category: OpportunityCategorySelection
  commodity: OpportunityCommoditySelection
  region: string
  tenementType: OpportunityTenementSelection
  dealStructure: OpportunityDealStructureSelection
  verification: OpportunityVerificationSelection
  status: OpportunityStatusSelection
  sort: OpportunitySortSelection
  savedOnly: boolean
}

export const DEFAULT_OPPORTUNITIES_FILTER: OpportunitiesFilterState = {
  q: '',
  category: 'ALL',
  commodity: 'ALL',
  region: 'ALL',
  tenementType: 'ALL',
  dealStructure: 'ALL',
  verification: 'ALL',
  status: 'open',
  sort: 'newest',
  savedOnly: false,
}

const MS_PER_DAY = 86_400_000

function parseDateMs(raw?: string | null): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = Date.parse(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

function getDaysUntilDate(raw?: string | null): number | null {
  const ms = parseDateMs(raw)
  if (ms === null) return null
  const now = new Date()
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.ceil((ms - todayStart) / MS_PER_DAY)
}

function minLevelForSelection(tier: OpportunityVerificationSelection): number {
  const found = OPPORTUNITY_VERIFICATION_TIERS.find((t) => t.value === tier)
  return found ? found.minLevel : 0
}

function verificationCodeToNum(code?: string | null, fallback = 0): number {
  const norm = normalizeVerificationLevel(code)
  switch (norm) {
    case 'L4':
      return 4
    case 'L3':
      return 3
    case 'L2':
      return 2
    case 'L1':
      return 1
    default:
      return fallback
  }
}

export function normalizeOpportunityCategoryParam(
  raw?: string | null,
): OpportunityCategorySelection {
  if (!raw) return 'ALL'
  const lower = raw.trim().toLowerCase()
  if (!lower || lower === 'all' || lower === 'all categories') return 'ALL'
  if (lower.includes('other')) return 'Others'
  if (lower.includes('tender')) return 'Exploration / Mining Tender'
  if (lower.includes('consult') || lower.includes('service provision')) return 'Consultancy'
  if (lower.includes('grant') || lower.includes('exploration opportunity')) {
    return 'Exploration Grant'
  }
  if (lower.includes('offtake') || lower.includes('supply') || lower.includes('equipment')) {
    return 'Offtake / Supply'
  }
  if (lower.includes('intern') || lower.includes('technical personnel') || lower.includes('engineer')) {
    return 'Internship'
  }
  if (
    lower.includes('joint') ||
    lower.includes('jv') ||
    lower.includes('partner') ||
    lower.includes('investment') ||
    lower.includes('licence') ||
    lower.includes('processing')
  ) {
    return 'Joint Venture'
  }
  return 'ALL'
}

export function normalizeCommodityParam(
  raw?: string | null,
): OpportunityCommoditySelection {
  if (!raw) return 'ALL'
  const lower = raw.trim().toLowerCase()
  if (!lower || lower === 'all' || lower === 'all commodities') return 'ALL'
  if (lower.includes('gold')) return 'Gold'
  if (lower.includes('copper')) return 'Copper'
  if (lower.includes('graphite')) return 'Graphite'
  if (lower.includes('tanzanite')) return 'Tanzanite'
  if (lower.includes('lithium')) return 'Lithium'
  if (lower.includes('rare earth')) return 'Rare Earths'
  if (lower.includes('nickel')) return 'Nickel'
  if (lower.includes('coal')) return 'Coal'
  if (
    lower.includes('industrial') ||
    lower.includes('limestone') ||
    lower.includes('gypsum') ||
    lower.includes('kaolin')
  ) {
    return 'Industrial Minerals'
  }
  return 'ALL'
}

export function normalizeTenementTypeParam(
  raw?: string | null,
): OpportunityTenementSelection {
  if (!raw) return 'ALL'
  const lower = raw.trim().toLowerCase()
  if (!lower || lower === 'all') return 'ALL'
  if (lower === 'pml') return 'PML'
  if (lower === 'pl') return 'PL'
  if (lower === 'ml') return 'ML'
  if (lower === 'sml') return 'SML'
  if (lower.includes('processing') || lower.includes('dealer') || lower.includes('broker')) {
    return 'Processing / Dealer'
  }
  if (lower.includes('n/a') || lower.includes('tender') || lower.includes('consult')) {
    return 'N/A (Tender / Consultancy)'
  }
  return 'ALL'
}

export function normalizeVerificationLevelParam(
  raw?: number | string | null,
): OpportunityVerificationSelection {
  if (raw === undefined || raw === null || raw === '') return 'ALL'
  const str = String(raw).toUpperCase().trim()
  if (str === '1' || str === 'L1') return 'L1'
  if (str === '2' || str === 'L2') return 'L2'
  if (str === '3' || str === 'L3') return 'L3'
  if (str === '4' || str === 'L4') return 'L4'
  return 'ALL'
}

export function normalizeSortParam(raw?: string | null): OpportunitySortSelection {
  if (!raw) return 'newest'
  const lower = raw.trim().toLowerCase()
  if (lower === 'closing-soonest' || lower === 'closing') return 'closing-soonest'
  if (lower === 'highest-value' || lower === 'investment-desc') return 'highest-value'
  return 'newest'
}

export function resolveProjectCategory(project: Project): OpportunityFilterCategory {
  switch (project.type) {
    case 'Tenders opportunity in mine sites':
      return 'Exploration / Mining Tender'
    case 'Service provision opportunities':
      return 'Consultancy'
    case 'Exploration opportunity':
      return 'Exploration Grant'
    case 'Equipment / project financing':
      return 'Offtake / Supply'
    case 'Technical personnel (Engineers & Technicians)':
      return 'Internship'
    case 'Others':
      return 'Others'
    default:
      return 'Joint Venture'
  }
}

export function resolveLiveOpportunityCategory(
  opp: Pick<UserOpportunityRecord, 'category' | 'structured_details'>,
): OpportunityFilterCategory {
  if (isOthersOpportunity(opp)) return 'Others'
  switch (opp.category) {
    case 'Joint Venture':
      return 'Joint Venture'
    case 'Tender':
      return 'Exploration / Mining Tender'
    case 'Consultancy':
      return 'Consultancy'
    case 'Grant':
      return 'Exploration Grant'
    case 'Equipment Supply':
      return 'Offtake / Supply'
    case 'Internship':
      return 'Internship'
    default:
      return 'Others'
  }
}

function matchesCommodityText(text: string, commodity: OpportunityCommodity): boolean {
  const lower = text.toLowerCase()
  if (commodity === 'Industrial Minerals') {
    return /industrial|limestone|gypsum|kaolin|silica|salt|phosphate|marble|dolomite/i.test(lower)
  }
  return lower.includes(commodity.toLowerCase())
}

function matchesTenementForProject(
  project: Project,
  tenement: OpportunityTenementType,
): boolean {
  if (tenement === 'N/A (Tender / Consultancy)') {
    return (
      project.type === 'Tenders opportunity in mine sites' ||
      project.type === 'Service provision opportunities' ||
      project.type === 'Technical personnel (Engineers & Technicians)'
    )
  }
  if (tenement === 'Processing / Dealer') {
    return project.licence.type === 'Processing Licence'
  }
  return project.licence.type === tenement
}

function matchesTenementForLiveOpp(
  opp: UserOpportunityRecord,
  tenement: OpportunityTenementType,
): boolean {
  const details =
    opp.structured_details && typeof opp.structured_details === 'object'
      ? (opp.structured_details as Record<string, unknown>)
      : null
  const rawLic = `${typeof details?.licenceType === 'string' ? details.licenceType : ''} ${typeof details?.licenceNumber === 'string' ? details.licenceNumber : ''}`.trim()
  const lower = rawLic.toLowerCase()

  if (tenement === 'N/A (Tender / Consultancy)') {
    return (
      !rawLic ||
      lower.includes('n/a') ||
      lower.includes('none') ||
      opp.category === 'Tender' ||
      opp.category === 'Consultancy' ||
      opp.category === 'Internship'
    )
  }
  if (tenement === 'Processing / Dealer') {
    return /processing|dealer|broker|smelt|refin/i.test(lower)
  }
  const re = new RegExp(`\\b${tenement.toLowerCase()}\\b`, 'i')
  return re.test(lower) || re.test(`${opp.title} ${opp.description}`)
}

function matchesTenementForLiveProject(
  proj: UserListedProject,
  tenement: OpportunityTenementType,
): boolean {
  const lower = (proj.licence_type || '').toLowerCase()
  if (tenement === 'N/A (Tender / Consultancy)') return false
  if (tenement === 'Processing / Dealer') {
    return /processing|dealer|broker/i.test(lower)
  }
  return lower === tenement.toLowerCase() || lower.startsWith(`${tenement.toLowerCase()} `)
}

function matchesDealStructureForProject(
  project: Project,
  structure: OpportunityDealStructure,
): boolean {
  const joined = `${project.dealTypes.join(' ')} ${project.transactionStatus} ${project.type}`.toLowerCase()
  switch (structure) {
    case 'Equity / Farm-In JV':
      return /equity|joint venture|farm-in|earn-in|operating partnership|partnership|assignment/.test(joined)
    case 'Fixed Budget':
      return /fixed|service contract|sla|consultancy|roster|advisory/.test(joined)
    case 'BoQ / Competitive Tender':
      return /tender|boq|bid|pre-qualification|epc/.test(joined)
    case 'Offtake / Supply':
      return /offtake|supply|equipment|project finance|financing|streaming/.test(joined)
    case 'Grant / Co-Funding':
      return /grant|co-fund|exploration opportunity/.test(joined)
  }
}

function matchesDealStructureForLiveOpp(
  opp: UserOpportunityRecord,
  structure: OpportunityDealStructure,
): boolean {
  const details =
    opp.structured_details && typeof opp.structured_details === 'object'
      ? (opp.structured_details as Record<string, unknown>)
      : null
  const compType =
    typeof details?.compensationType === 'string' ? details.compensationType : ''
  const joined = `${compType} ${opp.category} ${opp.title} ${opp.description}`.toLowerCase()

  switch (structure) {
    case 'Equity / Farm-In JV':
      return opp.category === 'Joint Venture' || /equity|farm-in|earn-in|joint venture|\bjv\b/.test(joined)
    case 'Fixed Budget':
      return opp.category === 'Consultancy' || opp.category === 'Internship' || /fixed|retainer|milestone|lump/.test(joined)
    case 'BoQ / Competitive Tender':
      return opp.category === 'Tender' || /tender|boq|competitive|bid/.test(joined)
    case 'Offtake / Supply':
      return opp.category === 'Equipment Supply' || /offtake|supply|equipment|procurement/.test(joined)
    case 'Grant / Co-Funding':
      return opp.category === 'Grant' || /grant|co-fund|subsidy/.test(joined)
  }
}

function matchesDealStructureForLiveProject(
  proj: UserListedProject,
  structure: OpportunityDealStructure,
): boolean {
  const joined = `${proj.title} ${proj.summary}`.toLowerCase()
  switch (structure) {
    case 'Equity / Farm-In JV':
      return true
    case 'Offtake / Supply':
      return /offtake|supply|equipment|finance/.test(joined)
    case 'Grant / Co-Funding':
      return /grant|co-fund|exploration/.test(joined)
    default:
      return false
  }
}

export function getLiveOpportunityVerificationTier(opp: UserOpportunityRecord): 0 | 1 | 2 | 3 | 4 {
  const details =
    opp.structured_details && typeof opp.structured_details === 'object'
      ? (opp.structured_details as Record<string, unknown>)
      : null
  const hasAttachments = Array.isArray(opp.attachments) && opp.attachments.length > 0
  const hasLicence =
    typeof details?.licenceNumber === 'string' && details.licenceNumber.trim().length > 0

  if (!opp.approved && opp.status !== 'active') return 0
  if (opp.is_featured && hasLicence && hasAttachments) return 4
  if (hasAttachments && hasLicence) return 3
  if (hasLicence || hasAttachments) return 2
  return 1
}

function isProjectClosed(project: Project): boolean {
  return /\bclosed\b|\bcompleted\b|\bexpired\b/i.test(project.transactionStatus)
}

function getProjectDaysToClose(project: Project): number | null {
  return getDaysUntilDate(project.licence.expires)
}

function isLiveOppClosed(opp: UserOpportunityRecord): boolean {
  if (opp.status === 'rejected') return true
  const days = getDaysUntilDate(opp.deadline)
  return days !== null && days < 0
}

function isLiveOppClosingSoon(opp: UserOpportunityRecord): boolean {
  if (opp.status === 'rejected') return false
  const days = getDaysUntilDate(opp.deadline)
  return days !== null && days >= 0 && days <= 14
}

export function filterAndSortProjects(
  projects: readonly Project[],
  filters: OpportunitiesFilterState,
  savedIds: readonly string[],
  localizeProject: (p: Project) => Project,
  tv: (val: string) => string,
): Project[] {
  const q = filters.q.trim().toLowerCase()
  const minLevel = minLevelForSelection(filters.verification)

  const filtered = projects.filter((p) => {
    if (filters.savedOnly && !savedIds.includes(p.id)) return false

    if (filters.category !== 'ALL' && resolveProjectCategory(p) !== filters.category) {
      return false
    }

    if (filters.commodity !== 'ALL') {
      const commText = [...p.minerals, ...p.minerals.map(tv), p.title, p.summary].join(' ')
      if (!matchesCommodityText(commText, filters.commodity)) return false
    }

    if (filters.region !== 'ALL' && p.region.toLowerCase() !== filters.region.toLowerCase()) {
      return false
    }

    if (
      filters.tenementType !== 'ALL' &&
      !matchesTenementForProject(p, filters.tenementType)
    ) {
      return false
    }

    if (
      filters.dealStructure !== 'ALL' &&
      !matchesDealStructureForProject(p, filters.dealStructure)
    ) {
      return false
    }

    if (minLevel > 0 && p.verification.level < minLevel) return false

    if (filters.status === 'open') {
      if (isProjectClosed(p)) return false
    } else if (filters.status === 'closing-soon') {
      const days = getProjectDaysToClose(p)
      const isSoon = days !== null && days >= 0 && days <= 14
      if (!isSoon) return false
    }

    if (q) {
      const loc = localizeProject(p)
      const haystack = [
        p.title,
        loc.title,
        p.id,
        p.owner.name,
        p.owner.kind,
        p.licence.type,
        p.licence.reference,
        p.region,
        p.district,
        p.summary,
        loc.summary,
        p.transactionStatus,
        ...p.highlights,
        ...p.dealTypes,
        ...p.minerals,
        ...p.minerals.map(tv),
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }

    return true
  })

  return [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case 'closing-soonest': {
        const aDays = getProjectDaysToClose(a) ?? Number.MAX_SAFE_INTEGER
        const bDays = getProjectDaysToClose(b) ?? Number.MAX_SAFE_INTEGER
        return aDays - bDays
      }
      case 'highest-value':
        return (b.askingPriceUsd ?? b.investmentUsd) - (a.askingPriceUsd ?? a.investmentUsd)
      case 'newest':
      default:
        return b.listedOn.localeCompare(a.listedOn) || b.updatedOn.localeCompare(a.updatedOn)
    }
  })
}

export function filterAndSortLiveOpportunities(
  opportunities: readonly UserOpportunityRecord[],
  filters: OpportunitiesFilterState,
): UserOpportunityRecord[] {
  const q = filters.q.trim().toLowerCase()
  const minLevel = minLevelForSelection(filters.verification)

  const filtered = opportunities.filter((opp) => {
    if (filters.savedOnly) return false

    if (filters.category !== 'ALL') {
      if (filters.category === 'Others') {
        if (!isOthersOpportunity(opp)) return false
      } else if (resolveLiveOpportunityCategory(opp) !== filters.category) {
        return false
      }
    }

    const details =
      opp.structured_details && typeof opp.structured_details === 'object'
        ? (opp.structured_details as Record<string, unknown>)
        : null

    if (filters.commodity !== 'ALL') {
      const commHay = [
        typeof details?.commodity === 'string' ? details.commodity : '',
        typeof details?.customCategory === 'string' ? details.customCategory : '',
        opp.title,
        opp.description,
      ].join(' ')
      if (!matchesCommodityText(commHay, filters.commodity)) return false
    }

    if (filters.region !== 'ALL') {
      const regionHay = [
        opp.location,
        typeof details?.region === 'string' ? details.region : '',
      ]
        .join(' ')
        .toLowerCase()
      if (!regionHay.includes(filters.region.toLowerCase())) return false
    }

    if (
      filters.tenementType !== 'ALL' &&
      !matchesTenementForLiveOpp(opp, filters.tenementType)
    ) {
      return false
    }

    if (
      filters.dealStructure !== 'ALL' &&
      !matchesDealStructureForLiveOpp(opp, filters.dealStructure)
    ) {
      return false
    }

    if (minLevel > 0 && getLiveOpportunityVerificationTier(opp) < minLevel) {
      return false
    }

    if (filters.status === 'open') {
      if (isLiveOppClosed(opp)) return false
    } else if (filters.status === 'closing-soon') {
      if (!isLiveOppClosingSoon(opp)) return false
    }

    if (q) {
      const displayCat = formatOpportunityCategory(opp)
      const haystack = [
        opp.title,
        opp.organization,
        opp.category,
        displayCat,
        opp.location,
        opp.reference_code,
        opp.description,
        opp.deadline,
        ...(opp.requirements ?? []),
        typeof details?.district === 'string' ? details.district : '',
        typeof details?.licenceType === 'string' ? details.licenceType : '',
        typeof details?.licenceNumber === 'string' ? details.licenceNumber : '',
        typeof details?.commodity === 'string' ? details.commodity : '',
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }

    return true
  })

  return [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case 'closing-soonest': {
        const aDays = getDaysUntilDate(a.deadline)
        const bDays = getDaysUntilDate(b.deadline)
        const aVal = aDays !== null && aDays >= 0 ? aDays : Number.MAX_SAFE_INTEGER
        const bVal = bDays !== null && bDays >= 0 ? bDays : Number.MAX_SAFE_INTEGER
        return aVal - bVal
      }
      case 'highest-value':
        return (b.compensation_usd || 0) - (a.compensation_usd || 0)
      case 'newest':
      default:
        return (b.created_at || '').localeCompare(a.created_at || '')
    }
  })
}

export function filterAndSortLiveProjects(
  projects: readonly UserListedProject[],
  filters: OpportunitiesFilterState,
): UserListedProject[] {
  const q = filters.q.trim().toLowerCase()
  const minLevel = minLevelForSelection(filters.verification)

  const filtered = projects.filter((proj) => {
    if (filters.savedOnly) return false

    if (
      filters.category !== 'ALL' &&
      filters.category !== 'Joint Venture' &&
      filters.category !== 'Exploration Grant'
    ) {
      return false
    }

    if (
      filters.commodity !== 'ALL' &&
      !matchesCommodityText(`${proj.mineral} ${proj.title} ${proj.summary}`, filters.commodity)
    ) {
      return false
    }

    if (
      filters.region !== 'ALL' &&
      !proj.region.toLowerCase().includes(filters.region.toLowerCase())
    ) {
      return false
    }

    if (
      filters.tenementType !== 'ALL' &&
      !matchesTenementForLiveProject(proj, filters.tenementType)
    ) {
      return false
    }

    if (
      filters.dealStructure !== 'ALL' &&
      !matchesDealStructureForLiveProject(proj, filters.dealStructure)
    ) {
      return false
    }

    if (minLevel > 0) {
      const levelNum = verificationCodeToNum(
        proj.verification_level,
        proj.approved || proj.status === 'VERIFIED' ? 1 : 0,
      )
      if (levelNum < minLevel) return false
    }

    if (filters.status === 'open') {
      if (proj.status === 'REJECTED') return false
    } else if (filters.status === 'closing-soon') {
      return false
    }

    if (q) {
      const haystack = [
        proj.title,
        proj.mineral,
        proj.region,
        proj.licence_type,
        proj.licence_reference,
        proj.summary,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }

    return true
  })

  return [...filtered].sort((a, b) => {
    switch (filters.sort) {
      case 'highest-value':
        return (b.investment_usd || 0) - (a.investment_usd || 0)
      case 'closing-soonest':
      case 'newest':
      default:
        return (b.created_at || '').localeCompare(a.created_at || '')
    }
  })
}

export function countSecondaryOpportunityFilters(filters: OpportunitiesFilterState): number {
  return (
    (filters.commodity !== 'ALL' ? 1 : 0) +
    (filters.region !== 'ALL' ? 1 : 0) +
    (filters.tenementType !== 'ALL' ? 1 : 0) +
    (filters.dealStructure !== 'ALL' ? 1 : 0) +
    (filters.verification !== 'ALL' ? 1 : 0) +
    (filters.status !== DEFAULT_OPPORTUNITIES_FILTER.status ? 1 : 0) +
    (filters.sort !== DEFAULT_OPPORTUNITIES_FILTER.sort ? 1 : 0) +
    (filters.savedOnly ? 1 : 0)
  )
}
