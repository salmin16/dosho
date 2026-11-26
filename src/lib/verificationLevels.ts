/**
 * Centralized 5-Tier Custom Verification Architecture (`L0`–`L4`).
 *
 * `verification_level` is strictly decoupled from subscription plans
 * (`Explorer`, `Operator Pro`, `Institutional / JV Desk`).
 * Both verification pilot quotas and subscription quotas are enforced independently.
 */

export type VerificationLevelCode = 'L0' | 'L1' | 'L2' | 'L3' | 'L4'
export type VerificationLevelNumber = 0 | 1 | 2 | 3 | 4

export interface VerificationLevelSpec {
  code: VerificationLevelCode
  level: VerificationLevelNumber
  title: string
  short: string
  /** Pilot active-listing cap associated with this verification tier */
  pilotListingQuota: number
  description: string
  checksPerformed: readonly string[]
  /** Explicit scope limitation displayed on listings, dossiers, and dashboards */
  limitsOfLevel: string
  badgeClasses: string
}

export const VERIFICATION_LEVELS: Record<
  VerificationLevelCode,
  VerificationLevelSpec
> = {
  L0: {
    code: 'L0',
    level: 0,
    title: 'Unverified',
    short: 'Self-declared',
    pilotListingQuota: 1,
    description:
      'Information supplied by the project owner and not yet independently checked.',
    checksPerformed: [
      'Mandatory moderation for prohibited claims',
      'Duplicate-listing screening',
    ],
    limitsOfLevel:
      'Identity, licence status and technical claims are unchecked.',
    badgeClasses: 'bg-paper-2 text-stone border-sand',
  },
  L1: {
    code: 'L1',
    level: 1,
    title: 'Identity & Documents',
    short: 'KYC checked',
    pilotListingQuota: 3,
    description:
      'The submitting individual or company and basic supporting documents have been checked.',
    checksPerformed: [
      'Owner identity / company registration',
      'Authorised representative',
      'Basic document completeness',
    ],
    limitsOfLevel:
      'Licence standing and geological evidence are not reviewed.',
    badgeClasses: 'bg-[#f3e9d2] text-[#7a5a1c] border-[#e4d1a3]',
  },
  L2: {
    code: 'L2',
    level: 2,
    title: 'Licence Record Check',
    short: 'Licence checked',
    pilotListingQuota: 6,
    description:
      'Available licence or right information is checked against appropriate authoritative records or documents.',
    checksPerformed: [
      'Licence reference & holder match',
      'Status, issue and expiry dates',
      'Area / coordinates consistency',
    ],
    limitsOfLevel:
      'Does not confirm transferability or licensing-authority consent.',
    badgeClasses: 'bg-[#f6e3bf] text-[#7a4f0e] border-gold/50',
  },
  L3: {
    code: 'L3',
    level: 3,
    title: 'Technical Review',
    short: 'Technically reviewed',
    pilotListingQuota: 8,
    description:
      'A qualified professional has reviewed the supplied technical evidence — sampling, assays and reports.',
    checksPerformed: [
      'Sampling & assay chain of custody',
      'Laboratory certificates',
      'Consistency of technical reports',
    ],
    limitsOfLevel:
      'This is not a mineral-resource estimate or a guarantee of grade.',
    badgeClasses: 'bg-[#f5dccb] text-ochre-dark border-ochre/40',
  },
  L4: {
    code: 'L4',
    level: 4,
    title: 'Site & Due Diligence',
    short: 'Site visited',
    pilotListingQuota: 1,
    description:
      'Site visit and/or specialist due diligence has been commissioned and completed for a client.',
    checksPerformed: [
      'Independent site visit',
      'Community & access observations',
      'Specialist due-diligence report',
    ],
    limitsOfLevel:
      'Findings are point-in-time and do not replace your own legal and technical advice.',
    badgeClasses: 'bg-moss-light text-moss border-moss/40',
  },
}

export const VERIFICATION_LEVEL_CODES: readonly VerificationLevelCode[] = [
  'L0',
  'L1',
  'L2',
  'L3',
  'L4',
] as const

export const VERIFICATION_LEVEL_LIST: readonly VerificationLevelSpec[] =
  VERIFICATION_LEVEL_CODES.map((code) => VERIFICATION_LEVELS[code])

export function normalizeVerificationLevel(
  input?: string | number | null,
  fallbackStatus?: string | null,
): VerificationLevelCode {
  if (typeof input === 'number' && Number.isInteger(input)) {
    if (input >= 0 && input <= 4) {
      return `L${input}` as VerificationLevelCode
    }
  }
  if (typeof input === 'string') {
    const clean = input.trim().toUpperCase()
    if (
      clean === 'L0' ||
      clean === 'L1' ||
      clean === 'L2' ||
      clean === 'L3' ||
      clean === 'L4'
    ) {
      return clean
    }
    const digitMatch = clean.match(/^LEVEL\s*([0-4])$|^([0-4])$/)
    const digit = digitMatch?.[1] ?? digitMatch?.[2]
    if (digit) {
      return `L${digit}` as VerificationLevelCode
    }
  }
  if (String(fallbackStatus ?? '').trim().toLowerCase() === 'verified') {
    return 'L1'
  }
  return 'L0'
}

export function verificationCodeToNumber(
  input?: string | number | null,
  fallbackStatus?: string | null,
): VerificationLevelNumber {
  const code = normalizeVerificationLevel(input, fallbackStatus)
  return VERIFICATION_LEVELS[code].level
}

export function getVerificationSpec(
  input?: string | number | null,
  fallbackStatus?: string | null,
): VerificationLevelSpec {
  const code = normalizeVerificationLevel(input, fallbackStatus)
  return VERIFICATION_LEVELS[code]
}

export interface DecoupledQuotaEvaluation {
  allowed: boolean
  verificationLevel: VerificationLevelCode
  verificationPilotQuota: number
  subscriptionLimit: number
  subscriptionUnlimited: boolean
  effectiveLimit: number
  activeListingsUsed: number
  blockedBy: 'subscription' | 'verification_pilot' | null
  reason: string | null
}

/**
 * Evaluates BOTH the decoupled verification pilot quota (`L0`–`L4`) and the
 * active subscription listing quota (`Explorer`, `Operator Pro`, `Institutional`).
 */
export function evaluateListingQuotas(params: {
  verificationLevel: VerificationLevelCode
  activeListingsUsed: number
  isPaidActive: boolean
  subscriptionMaxListings: number
  isAdmin?: boolean
}): DecoupledQuotaEvaluation {
  const spec = VERIFICATION_LEVELS[params.verificationLevel]
  const pilotQuota = spec.pilotListingQuota
  const subUnlimited =
    params.subscriptionMaxListings < 0 || params.subscriptionMaxListings >= 999

  if (params.isAdmin) {
    return {
      allowed: true,
      verificationLevel: spec.code,
      verificationPilotQuota: pilotQuota,
      subscriptionLimit: -1,
      subscriptionUnlimited: true,
      effectiveLimit: 999,
      activeListingsUsed: params.activeListingsUsed,
      blockedBy: null,
      reason: null,
    }
  }

  if (!params.isPaidActive || params.subscriptionMaxListings === 0) {
    return {
      allowed: false,
      verificationLevel: spec.code,
      verificationPilotQuota: pilotQuota,
      subscriptionLimit: 0,
      subscriptionUnlimited: false,
      effectiveLimit: 0,
      activeListingsUsed: params.activeListingsUsed,
      blockedBy: 'subscription',
      reason:
        'An active paid subscription (Operator Pro or Institutional / JV Desk) is required to publish listings.',
    }
  }

  const effectiveLimit = subUnlimited
    ? pilotQuota
    : Math.min(params.subscriptionMaxListings, pilotQuota)

  if (!subUnlimited && params.activeListingsUsed >= params.subscriptionMaxListings) {
    return {
      allowed: false,
      verificationLevel: spec.code,
      verificationPilotQuota: pilotQuota,
      subscriptionLimit: params.subscriptionMaxListings,
      subscriptionUnlimited: false,
      effectiveLimit,
      activeListingsUsed: params.activeListingsUsed,
      blockedBy: 'subscription',
      reason: `Your subscription plan allows up to ${params.subscriptionMaxListings} active listing(s). Upgrade your plan to publish more.`,
    }
  }

  if (params.activeListingsUsed >= pilotQuota) {
    return {
      allowed: false,
      verificationLevel: spec.code,
      verificationPilotQuota: pilotQuota,
      subscriptionLimit: params.subscriptionMaxListings,
      subscriptionUnlimited: subUnlimited,
      effectiveLimit,
      activeListingsUsed: params.activeListingsUsed,
      blockedBy: 'verification_pilot',
      reason: `Verification level ${spec.code} (${spec.title}) has a pilot quota of ${pilotQuota} active listing(s). Request a higher verification level in your Member Vault to expand your pilot cap.`,
    }
  }

  return {
    allowed: true,
    verificationLevel: spec.code,
    verificationPilotQuota: pilotQuota,
    subscriptionLimit: params.subscriptionMaxListings,
    subscriptionUnlimited: subUnlimited,
    effectiveLimit,
    activeListingsUsed: params.activeListingsUsed,
    blockedBy: null,
    reason: null,
  }
}
