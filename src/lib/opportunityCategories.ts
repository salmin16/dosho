import type { UserOpportunityRecord } from '../types/database'

/**
 * Extracts a clean custom category specification when an opportunity
 * was published under "Others".
 */
export function getOpportunityCustomCategory(
  opp: Pick<UserOpportunityRecord, 'category' | 'structured_details'>,
): string | null {
  const details =
    opp.structured_details && typeof opp.structured_details === 'object'
      ? (opp.structured_details as Record<string, unknown>)
      : null
  const custom =
    typeof details?.customCategory === 'string'
      ? details.customCategory.trim()
      : ''
  return custom || null
}

/**
 * Returns true if the opportunity belongs to the "Others" category
 * (including records stored via fallback while migration propagates).
 */
export function isOthersOpportunity(
  opp: Pick<UserOpportunityRecord, 'category' | 'structured_details'>,
): boolean {
  if (opp.category === 'Others') return true
  const details =
    opp.structured_details && typeof opp.structured_details === 'object'
      ? (opp.structured_details as Record<string, unknown>)
      : null
  return details?.categoryLabel === 'Others' || Boolean(getOpportunityCustomCategory(opp))
}

/**
 * Formats an opportunity's display category cleanly across the Marketplace,
 * User Dashboard, Wizard History, and Admin Review Queue.
 */
export function formatOpportunityCategory(
  opp: Pick<UserOpportunityRecord, 'category' | 'structured_details'>,
): string {
  const custom = getOpportunityCustomCategory(opp)
  if (isOthersOpportunity(opp)) {
    return custom ? `Others · ${custom}` : 'Others'
  }
  return opp.category
}
