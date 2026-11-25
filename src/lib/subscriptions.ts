'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  recordAuditActivity,
  useAuthSession,
  waitForAuthReady,
} from './supabaseAuth';
import { getSupabaseClient } from './supabaseClient';
import {
  formatSafeUserError,
  verifyTurnstileForForm,
} from './verifyTurnstileClient';
import type {
  AccountBillingState,
  AdminAccountLedgerRow,
  BillingCycle,
  PaymentTransactionRecord,
  SubscriptionPaymentRecord,
  SubscriptionPlanId,
  SubscriptionPlanRecord,
  SubscriptionTierName,
  SupportedCurrency,
  UserEntitlements,
  UserSubscriptionRecord,
} from '../types/database';

export const SUBSCRIPTION_UPDATED_EVENT = 'mineconnect:subscription-updated';

/**
 * Statutory baseline TZS-to-USD parity used for fallback conversions
 */
export const STATUTORY_TZS_PER_USD = 2685;

/**
 * Canonical 3-Tier Institutional Subscription Plans (`public.subscription_plans`)
 */
export const CANONICAL_SUBSCRIPTION_PLANS: readonly SubscriptionPlanRecord[] = [
  {
    id: 'free',
    name: 'Explorer',
    tagline: 'View-only market benchmarks, 31-Mikoa GIS map & public listing previews',
    price_tzs: 0,
    price_usd: 0,
    billing_cycle: 'monthly',
    max_active_listings: 0,
    max_monthly_rfqs: 0,
    can_access_data_room: false,
    can_export_markets: false,
    is_active: true,
    sort_order: 1,
  },
  {
    id: 'pro',
    name: 'Operator Pro',
    tagline: 'Up to 3 active listings, 25 RFQs/mo, full tenement dossiers & CSV valuation exports',
    price_tzs: 120_000,
    price_usd: 45,
    billing_cycle: 'monthly',
    max_active_listings: 3,
    max_monthly_rfqs: 25,
    can_access_data_room: false,
    can_export_markets: true,
    is_active: true,
    sort_order: 2,
  },
  {
    id: 'enterprise',
    name: 'Institutional / JV Desk',
    tagline: 'Unlimited listings & RFQs, full NDA Data Room documents & valuation CSV exports',
    price_tzs: 450_000,
    price_usd: 170,
    billing_cycle: 'monthly',
    max_active_listings: -1,
    max_monthly_rfqs: -1,
    can_access_data_room: true,
    can_export_markets: true,
    is_active: true,
    sort_order: 3,
  },
] as const;

export const PLAN_FEATURE_BULLETS: Record<SubscriptionPlanId, string[]> = {
  free: [
    'View-only market benchmarks, Multi-Year Trend Chart & 31-Mikoa GIS Map',
    'Browse public listing & technical service previews only',
    '0 project, opportunity, or service listings (upgrade to publish)',
    '0 quote, information, or due-diligence requests · No dossier or contact unlock',
  ],
  pro: [
    'Publish up to 3 active mining projects, opportunities & services',
    'Up to 25 Quote, Info & Due-Diligence Requests (RFQs) per month',
    'Full Tenement & Due-Diligence Dossier + Direct Counterparty Contacts',
    'Export Markets Valuation CSV (Live Spot Feed & Statutory Matrix)',
  ],
  enterprise: [
    'Unlimited active project, opportunity & technical service listings',
    'Unlimited monthly Quote, Info & Due-Diligence Requests (RFQs)',
    'Full Tenement Dossier, Direct Contacts & Restricted NDA Data Room Docs',
    'Export Markets Valuation CSV (Spot Feed & Matrix in TZS / USD / EUR)',
  ],
};

export function normalizePlanId(input?: string | null): SubscriptionPlanId {
  const clean = String(input ?? '').trim().toLowerCase();
  if (
    clean === 'enterprise' ||
    clean === 'institutional' ||
    clean === 'institutional / jv desk' ||
    clean === 'corporate' ||
    clean === 'investor'
  ) {
    return 'enterprise';
  }
  if (
    clean === 'pro' ||
    clean === 'operator pro' ||
    clean === 'professional' ||
    clean === 'miner'
  ) {
    return 'pro';
  }
  return 'free';
}

export function getPlanHeaderLabel(planId: SubscriptionPlanId): string {
  if (planId === 'enterprise') return 'Institutional';
  if (planId === 'pro') return 'Operator Pro';
  return 'Explorer';
}

export interface TierQuotas {
  maxProjectListings: number;
  maxMonthlyRfqs: number;
  maxOpportunityListings: number;
  maxServiceListings: number;
  maxVaultDocuments: number;
}

export interface TierPermissions {
  canListProject: boolean;
  canHostDocuments: boolean;
  canViewAnalytics: boolean;
  canAccessDealRoom: boolean;
  canExportMarkets: boolean;
  canUseAdvancedMapFilters: boolean;
  canPriorityPlacement: boolean;
  teamSeats: number;
}

export interface SubscriptionTierConfig {
  id: string;
  planId: SubscriptionPlanId;
  tierName: SubscriptionTierName;
  rank: number;
  monthlyTzs: number;
  yearlyTzs: number;
  monthlyUsd: number;
  yearlyUsd: number;
  tagline: string;
  highlighted?: boolean;
  quotas: TierQuotas;
  permissions: TierPermissions;
  features: string[];
}

export const SUBSCRIPTION_TIERS: Record<
  SubscriptionTierName,
  SubscriptionTierConfig
> = {
  Explorer: {
    id: 'free',
    planId: 'free',
    tierName: 'Explorer',
    rank: 0,
    monthlyTzs: 0,
    yearlyTzs: 0,
    monthlyUsd: 0,
    yearlyUsd: 0,
    tagline: CANONICAL_SUBSCRIPTION_PLANS[0].tagline,
    quotas: {
      maxProjectListings: 0,
      maxMonthlyRfqs: 0,
      maxOpportunityListings: 0,
      maxServiceListings: 0,
      maxVaultDocuments: 2,
    },
    permissions: {
      canListProject: false,
      canHostDocuments: false,
      canViewAnalytics: false,
      canAccessDealRoom: false,
      canExportMarkets: false,
      canUseAdvancedMapFilters: false,
      canPriorityPlacement: false,
      teamSeats: 1,
    },
    features: PLAN_FEATURE_BULLETS.free,
  },
  'Operator Pro': {
    id: 'pro',
    planId: 'pro',
    tierName: 'Operator Pro',
    rank: 1,
    monthlyTzs: 120_000,
    yearlyTzs: 1_200_000,
    monthlyUsd: 45,
    yearlyUsd: 450,
    tagline: CANONICAL_SUBSCRIPTION_PLANS[1].tagline,
    highlighted: true,
    quotas: {
      maxProjectListings: 3,
      maxMonthlyRfqs: 25,
      maxOpportunityListings: 10,
      maxServiceListings: 5,
      maxVaultDocuments: 50,
    },
    permissions: {
      canListProject: true,
      canHostDocuments: true,
      canViewAnalytics: true,
      canAccessDealRoom: false,
      canExportMarkets: true,
      canUseAdvancedMapFilters: true,
      canPriorityPlacement: true,
      teamSeats: 3,
    },
    features: PLAN_FEATURE_BULLETS.pro,
  },
  'Institutional / JV Desk': {
    id: 'enterprise',
    planId: 'enterprise',
    tierName: 'Institutional / JV Desk',
    rank: 2,
    monthlyTzs: 450_000,
    yearlyTzs: 4_500_000,
    monthlyUsd: 170,
    yearlyUsd: 1_700,
    tagline: CANONICAL_SUBSCRIPTION_PLANS[2].tagline,
    quotas: {
      maxProjectListings: 999,
      maxMonthlyRfqs: 999,
      maxOpportunityListings: 999,
      maxServiceListings: 999,
      maxVaultDocuments: 999,
    },
    permissions: {
      canListProject: true,
      canHostDocuments: true,
      canViewAnalytics: true,
      canAccessDealRoom: true,
      canExportMarkets: true,
      canUseAdvancedMapFilters: true,
      canPriorityPlacement: true,
      teamSeats: 25,
    },
    features: PLAN_FEATURE_BULLETS.enterprise,
  },
  // Legacy tier aliases kept for ClickPesa/checkout route compatibility
  Miner: {
    id: 'pro',
    planId: 'pro',
    tierName: 'Miner',
    rank: 1,
    monthlyTzs: 120_000,
    yearlyTzs: 1_200_000,
    monthlyUsd: 45,
    yearlyUsd: 450,
    tagline: CANONICAL_SUBSCRIPTION_PLANS[1].tagline,
    quotas: {
      maxProjectListings: 3,
      maxMonthlyRfqs: 25,
      maxOpportunityListings: 5,
      maxServiceListings: 2,
      maxVaultDocuments: 25,
    },
    permissions: {
      canListProject: true,
      canHostDocuments: true,
      canViewAnalytics: true,
      canAccessDealRoom: false,
      canExportMarkets: true,
      canUseAdvancedMapFilters: true,
      canPriorityPlacement: false,
      teamSeats: 1,
    },
    features: PLAN_FEATURE_BULLETS.pro,
  },
  Professional: {
    id: 'pro',
    planId: 'pro',
    tierName: 'Professional',
    rank: 1,
    monthlyTzs: 120_000,
    yearlyTzs: 1_200_000,
    monthlyUsd: 45,
    yearlyUsd: 450,
    tagline: CANONICAL_SUBSCRIPTION_PLANS[1].tagline,
    quotas: {
      maxProjectListings: 3,
      maxMonthlyRfqs: 25,
      maxOpportunityListings: 10,
      maxServiceListings: 5,
      maxVaultDocuments: 50,
    },
    permissions: {
      canListProject: true,
      canHostDocuments: true,
      canViewAnalytics: true,
      canAccessDealRoom: false,
      canExportMarkets: true,
      canUseAdvancedMapFilters: true,
      canPriorityPlacement: true,
      teamSeats: 3,
    },
    features: PLAN_FEATURE_BULLETS.pro,
  },
  Investor: {
    id: 'enterprise',
    planId: 'enterprise',
    tierName: 'Investor',
    rank: 2,
    monthlyTzs: 450_000,
    yearlyTzs: 4_500_000,
    monthlyUsd: 170,
    yearlyUsd: 1_700,
    tagline: CANONICAL_SUBSCRIPTION_PLANS[2].tagline,
    highlighted: true,
    quotas: {
      maxProjectListings: 999,
      maxMonthlyRfqs: 999,
      maxOpportunityListings: 999,
      maxServiceListings: 999,
      maxVaultDocuments: 999,
    },
    permissions: {
      canListProject: true,
      canHostDocuments: true,
      canViewAnalytics: true,
      canAccessDealRoom: true,
      canExportMarkets: true,
      canUseAdvancedMapFilters: true,
      canPriorityPlacement: true,
      teamSeats: 10,
    },
    features: PLAN_FEATURE_BULLETS.enterprise,
  },
  Corporate: {
    id: 'enterprise',
    planId: 'enterprise',
    tierName: 'Corporate',
    rank: 2,
    monthlyTzs: 450_000,
    yearlyTzs: 4_500_000,
    monthlyUsd: 170,
    yearlyUsd: 1_700,
    tagline: CANONICAL_SUBSCRIPTION_PLANS[2].tagline,
    quotas: {
      maxProjectListings: 999,
      maxMonthlyRfqs: 999,
      maxOpportunityListings: 999,
      maxServiceListings: 999,
      maxVaultDocuments: 999,
    },
    permissions: {
      canListProject: true,
      canHostDocuments: true,
      canViewAnalytics: true,
      canAccessDealRoom: true,
      canExportMarkets: true,
      canUseAdvancedMapFilters: true,
      canPriorityPlacement: true,
      teamSeats: 25,
    },
    features: PLAN_FEATURE_BULLETS.enterprise,
  },
};

export const SUBSCRIPTION_TIER_LIST: SubscriptionTierConfig[] = [
  SUBSCRIPTION_TIERS.Explorer,
  SUBSCRIPTION_TIERS['Operator Pro'],
  SUBSCRIPTION_TIERS['Institutional / JV Desk'],
];

export function normalizeSubscriptionTier(
  input?: string | null,
): SubscriptionTierName {
  if (!input) return 'Explorer';
  const clean = input.trim().toLowerCase();
  switch (clean) {
    case 'pro':
    case 'operator pro':
      return 'Operator Pro';
    case 'enterprise':
    case 'institutional':
    case 'institutional / jv desk':
      return 'Institutional / JV Desk';
    case 'miner':
      return 'Miner';
    case 'professional':
      return 'Professional';
    case 'investor':
      return 'Investor';
    case 'corporate':
      return 'Corporate';
    case 'free':
    case 'explorer':
    default:
      return 'Explorer';
  }
}

export function normalizeBillingCycle(input?: string | null): BillingCycle {
  if (!input) return 'monthly';
  return input.trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly';
}

export function resolveVerifiedTierPricing(
  tierInput: string,
  billingInput: string,
): {
  tierConfig: SubscriptionTierConfig;
  tierName: SubscriptionTierName;
  billingCycle: BillingCycle;
  verifiedAmountTzs: number;
  verifiedAmountUsd: number;
  durationDays: number;
} {
  const tierName = normalizeSubscriptionTier(tierInput);
  const billingCycle = normalizeBillingCycle(billingInput);
  const tierConfig = SUBSCRIPTION_TIERS[tierName];

  const verifiedAmountTzs =
    billingCycle === 'yearly' ? tierConfig.yearlyTzs : tierConfig.monthlyTzs;
  const verifiedAmountUsd =
    billingCycle === 'yearly' ? tierConfig.yearlyUsd : tierConfig.monthlyUsd;
  const durationDays = billingCycle === 'yearly' ? 365 : 30;

  return {
    tierConfig,
    tierName,
    billingCycle,
    verifiedAmountTzs,
    verifiedAmountUsd,
    durationDays,
  };
}

let cachedPlans: SubscriptionPlanRecord[] = [...CANONICAL_SUBSCRIPTION_PLANS];
const subscriptionCache = new Map<string, UserSubscriptionRecord>();
const entitlementsCache = new Map<string, UserEntitlements>();
const transactionsCache = new Map<string, PaymentTransactionRecord[]>();
const paymentsCache = new Map<string, SubscriptionPaymentRecord[]>();

function createDefaultExplorerSubscription(
  userId?: string | null,
): UserSubscriptionRecord {
  const now = new Date();
  const expiresDefault = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  return {
    id: userId ? `sub-${userId.slice(0, 8)}` : 'sub-guest-explorer',
    user_id: userId || 'guest',
    plan_id: 'free',
    tier_name: 'Explorer',
    status: 'active',
    billing_cycle: 'monthly',
    price_tzs: 0,
    price_usd: 0,
    payment_gateway: 'FREE_TIER',
    payment_method: 'FREE',
    payment_rail: 'FREE',
    payment_provider: 'FREE',
    payment_reference: null,
    starts_at: now.toISOString(),
    expires_at: expiresDefault,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

function createDefaultEntitlements(isAdmin = false): UserEntitlements {
  if (isAdmin) {
    const now = new Date();
    const expires = new Date(now.getTime() + 365 * 86_400_000).toISOString();
    return {
      plan_id: 'enterprise',
      plan_name: 'Institutional / JV Desk',
      status: 'active',
      account_state: 'active',
      is_paid_active: true,
      starts_at: now.toISOString(),
      expires_at: expires,
      max_active_listings: -1,
      max_monthly_rfqs: -1,
      active_listings_count: 0,
      monthly_rfqs_count: 0,
      can_access_data_room: true,
      can_export_markets: true,
    };
  }
  return {
    plan_id: 'free',
    plan_name: 'Explorer',
    status: 'active',
    account_state: 'free',
    is_paid_active: false,
    starts_at: null,
    expires_at: null,
    max_active_listings: 0,
    max_monthly_rfqs: 0,
    active_listings_count: 0,
    monthly_rfqs_count: 0,
    can_access_data_room: false,
    can_export_markets: false,
  };
}

export function getCachedSubscriptionPlans(): SubscriptionPlanRecord[] {
  return cachedPlans;
}

export async function fetchSubscriptionPlans(): Promise<
  SubscriptionPlanRecord[]
> {
  const supabase = getSupabaseClient();
  if (!supabase) return cachedPlans;

  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
      cachedPlans = data.map((row) => {
        const normalizedId = normalizePlanId(row.id);
        return {
          ...row,
          id: normalizedId,
          tagline:
            normalizedId === 'free'
              ? CANONICAL_SUBSCRIPTION_PLANS[0].tagline
              : row.tagline,
          price_tzs: Number(row.price_tzs) || 0,
          price_usd: Number(row.price_usd) || 0,
          max_active_listings:
            normalizedId === 'free' ? 0 : Number(row.max_active_listings),
          max_monthly_rfqs:
            normalizedId === 'free' ? 0 : Number(row.max_monthly_rfqs),
          can_access_data_room:
            normalizedId === 'free' ? false : Boolean(row.can_access_data_room),
          can_export_markets:
            normalizedId === 'free' ? false : Boolean(row.can_export_markets),
        };
      });
    }
  } catch {
    // Fallback smoothly to canonical plans if migration not yet executed
  }

  return cachedPlans;
}

export function getUserSubscription(
  userId?: string | null,
): UserSubscriptionRecord {
  if (!userId) return createDefaultExplorerSubscription(null);
  return (
    subscriptionCache.get(userId) ?? createDefaultExplorerSubscription(userId)
  );
}

export function getUserPaymentTransactions(
  userId?: string | null,
): PaymentTransactionRecord[] {
  if (!userId) return [];
  return transactionsCache.get(userId) ?? [];
}

export function getUserSubscriptionPayments(
  userId?: string | null,
): SubscriptionPaymentRecord[] {
  if (!userId) return [];
  return paymentsCache.get(userId) ?? [];
}

function broadcastSubscriptionUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SUBSCRIPTION_UPDATED_EVENT));
  }
}

export async function fetchUserSubscriptionFromSupabase(
  userId: string,
  userEmail?: string | null,
  isAdmin = false,
): Promise<{
  plans: SubscriptionPlanRecord[];
  subscription: UserSubscriptionRecord;
  entitlements: UserEntitlements;
  payments: SubscriptionPaymentRecord[];
  transactions: PaymentTransactionRecord[];
}> {
  const plans = await fetchSubscriptionPlans();
  const supabase = getSupabaseClient();
  const adminAccount =
    isAdmin || (userEmail ?? '').trim().toLowerCase() === 'salminmwenesi@gmail.com';

  if (!supabase) {
    return {
      plans,
      subscription: createDefaultExplorerSubscription(userId),
      entitlements: createDefaultEntitlements(adminAccount),
      payments: [],
      transactions: [],
    };
  }

  const [subRes, payRes, txRes, rpcRes] = await Promise.all([
    supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('subscription_payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('payment_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase.rpc('get_user_entitlements', { uid: userId }),
  ]);

  const rawSub = subRes.data ?? createDefaultExplorerSubscription(userId);
  const resolvedPlanId = normalizePlanId(rawSub.plan_id ?? rawSub.tier_name);
  const subscription: UserSubscriptionRecord = {
    ...rawSub,
    plan_id: resolvedPlanId,
  };

  const payments: SubscriptionPaymentRecord[] = Array.isArray(payRes.data)
    ? (payRes.data as SubscriptionPaymentRecord[])
    : [];
  const transactions: PaymentTransactionRecord[] = Array.isArray(txRes.data)
    ? (txRes.data as PaymentTransactionRecord[])
    : [];

  const hasPaidHistory =
    resolvedPlanId !== 'free' ||
    payments.some(
      (p) =>
        p.plan_id !== 'free' &&
        (p.status === 'settled' || p.status === 'approved'),
    );

  let entitlements: UserEntitlements;

  if (!rpcRes.error && rpcRes.data && typeof rpcRes.data === 'object') {
    const raw = rpcRes.data as Record<string, unknown>;
    const isPaidActive = Boolean(raw.is_paid_active);
    const derivedAccountState: AccountBillingState =
      raw.account_state === 'active' ||
      raw.account_state === 'dormant' ||
      raw.account_state === 'free'
        ? raw.account_state
        : isPaidActive
          ? 'active'
          : hasPaidHistory || raw.status === 'expired'
            ? 'dormant'
            : 'free';

    entitlements = {
      plan_id: normalizePlanId(String(raw.plan_id ?? 'free')),
      plan_name: String(raw.plan_name ?? 'Explorer'),
      status: (raw.status as UserEntitlements['status']) ?? 'active',
      account_state: derivedAccountState,
      is_paid_active: isPaidActive,
      starts_at: typeof raw.starts_at === 'string' ? raw.starts_at : null,
      expires_at: typeof raw.expires_at === 'string' ? raw.expires_at : null,
      max_active_listings: isPaidActive ? Number(raw.max_active_listings ?? 0) : 0,
      max_monthly_rfqs: isPaidActive ? Number(raw.max_monthly_rfqs ?? 0) : 0,
      active_listings_count: Number(raw.active_listings_count ?? 0),
      monthly_rfqs_count: Number(raw.monthly_rfqs_count ?? 0),
      can_access_data_room: Boolean(raw.can_access_data_room) && isPaidActive,
      can_export_markets: Boolean(raw.can_export_markets) && isPaidActive,
    };
  } else {
    // Fallback calculation if SQL RPC migration hasn't been executed yet
    const startOfMonthIso = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
    ).toISOString();

    const [projCountRes, quoteCountRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('status', 'in', '("rejected","hidden","archived")'),
      supabase
        .from('quotes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfMonthIso),
    ]);

    const activeListingsCount = projCountRes.count ?? 0;
    const monthlyRfqsCount = quoteCountRes.count ?? 0;

    if (adminAccount) {
      entitlements = {
        ...createDefaultEntitlements(true),
        active_listings_count: activeListingsCount,
        monthly_rfqs_count: monthlyRfqsCount,
      };
    } else {
      const expiresMs = Date.parse(subscription.expires_at);
      const isUnexpired = Number.isFinite(expiresMs) && expiresMs > Date.now();
      const isPaidActive =
        subscription.status === 'active' &&
        isUnexpired &&
        resolvedPlanId !== 'free';
      const effectivePlanId: SubscriptionPlanId = isPaidActive
        ? resolvedPlanId
        : 'free';
      const matchedPlan =
        plans.find((p) => p.id === effectivePlanId) ??
        CANONICAL_SUBSCRIPTION_PLANS[0];

      const effectiveStatus =
        subscription.status === 'active' && !isUnexpired && resolvedPlanId !== 'free'
          ? 'expired'
          : subscription.status;

      const derivedAccountState: AccountBillingState = isPaidActive
        ? 'active'
        : hasPaidHistory
          ? 'dormant'
          : 'free';

      entitlements = {
        plan_id: matchedPlan.id,
        plan_name: matchedPlan.name,
        status: effectiveStatus,
        account_state: derivedAccountState,
        is_paid_active: isPaidActive,
        starts_at: subscription.starts_at ?? subscription.created_at,
        expires_at: subscription.expires_at,
        max_active_listings: isPaidActive ? matchedPlan.max_active_listings : 0,
        max_monthly_rfqs: isPaidActive ? matchedPlan.max_monthly_rfqs : 0,
        active_listings_count: activeListingsCount,
        monthly_rfqs_count: monthlyRfqsCount,
        can_access_data_room: matchedPlan.can_access_data_room && isPaidActive,
        can_export_markets: matchedPlan.can_export_markets && isPaidActive,
      };
    }
  }

  subscriptionCache.set(userId, subscription);
  entitlementsCache.set(userId, entitlements);
  paymentsCache.set(userId, payments);
  transactionsCache.set(userId, transactions);

  return { plans, subscription, entitlements, payments, transactions };
}

/**
 * Corporate Mobile Money / NMB-CRDB Bank EFT Reference Submission (Turnstile Protected)
 * Creates a `pending_verification` payment record in `public.subscription_payments` for admin approval.
 */
export async function submitManualSubscriptionPayment(params: {
  planId: SubscriptionPlanId;
  currency: SupportedCurrency;
  amount: number;
  paymentMethod: string;
  referenceCode: string;
  receiptUrl?: string;
  notes?: string;
  turnstileToken: string;
}): Promise<{
  ok: boolean;
  payment?: SubscriptionPaymentRecord;
  error?: string;
}> {
  const session = await waitForAuthReady();
  if (!session) {
    return { ok: false, error: 'Please sign in before submitting a subscription payment.' };
  }

  if (params.planId === 'free') {
    return { ok: false, error: 'Explorer is already included free with your account.' };
  }

  const refClean = params.referenceCode.trim();
  if (refClean.length < 4) {
    return {
      ok: false,
      error: 'Please enter a valid transaction reference or bank slip number (at least 4 characters).',
    };
  }

  // Server-side Cloudflare Turnstile check before creating a billing verification entry
  const turnstileRes = await verifyTurnstileForForm(
    params.turnstileToken,
    'subscription-payment',
  );
  if (!turnstileRes.ok) {
    return {
      ok: false,
      error:
        turnstileRes.error ||
        'Security verification failed or expired. Please complete the challenge again.',
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: 'Billing service is temporarily unavailable.' };
  }

  const receiptClean = params.receiptUrl?.trim() || null;
  if (receiptClean && !/^https?:\/\//i.test(receiptClean)) {
    return {
      ok: false,
      error: 'Receipt link must start with https:// or http:// (or leave blank).',
    };
  }

  const { data, error } = await supabase
    .from('subscription_payments')
    .insert({
      user_id: session.user.id,
      plan_id: params.planId,
      amount: Math.max(0, Number(params.amount) || 0),
      currency: params.currency,
      payment_method: params.paymentMethod.trim(),
      reference_code: refClean,
      receipt_url: receiptClean,
      status: 'pending_verification',
      notes: params.notes?.trim() || null,
    })
    .select('*')
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: formatSafeUserError(
        error?.message,
        'Unable to submit your payment verification reference right now. Please try again.',
      ),
    };
  }

  recordAuditActivity({
    userId: session.user.id,
    action: 'SUBSCRIPTION_PAYMENT_SUBMITTED',
    metadata: {
      planId: params.planId,
      amount: params.amount,
      currency: params.currency,
      paymentMethod: params.paymentMethod,
      referenceCode: refClean,
    },
  });

  await fetchUserSubscriptionFromSupabase(
    session.user.id,
    session.user.email,
    session.user.role === 'admin',
  );
  broadcastSubscriptionUpdate();

  return { ok: true, payment: data as SubscriptionPaymentRecord };
}

export type AzamPayProviderCode =
  | 'Mpesa'
  | 'Tigo'
  | 'Airtel'
  | 'Halopesa'
  | 'Azampesa'
  | 'CRDB'
  | 'NMB'
  | 'NBC';

export type AzamPayTierSlug = 'operator_pro' | 'institutional_jv';

export interface AzamPayCheckoutResult {
  ok: boolean;
  externalId?: string;
  transactionId?: string;
  azampayTransactionId?: string | null;
  provider?: AzamPayProviderCode;
  channel?: 'mno' | 'bank';
  currency?: 'TZS';
  amountTzs?: number;
  tier?: AzamPayTierSlug;
  planId?: Exclude<SubscriptionPlanId, 'free'>;
  planName?: string;
  status?: 'pending' | 'completed' | 'failed';
  environment?: 'sandbox' | 'production';
  message?: string;
  error?: string;
}

export function resolveForcedTzsAmountForPlan(
  planId: Exclude<SubscriptionPlanId, 'free'>,
  priceTzs?: number | null,
  priceUsd?: number | null,
): number {
  const canonical =
    CANONICAL_SUBSCRIPTION_PLANS.find((p) => p.id === planId) ??
    CANONICAL_SUBSCRIPTION_PLANS[1];
  if (typeof priceTzs === 'number' && Number.isFinite(priceTzs) && priceTzs >= 1000) {
    return Math.round(priceTzs);
  }
  if (typeof priceUsd === 'number' && Number.isFinite(priceUsd) && priceUsd > 0) {
    return Math.max(1000, Math.round(priceUsd * STATUTORY_TZS_PER_USD));
  }
  return canonical.price_tzs;
}

export interface AzamPayTransactionStatus {
  id: string;
  external_id: string;
  status: 'pending' | 'completed' | 'failed';
  provider: string | null;
  amount_tzs: number;
  tier: string | null;
  azampay_transaction_id: string | null;
  updated_at: string;
}

/**
 * Initiates an AzamPay Mobile Money (MNO STK Push) or Bank Checkout
 * via the `azampay-checkout` Supabase Edge Function.
 */
export async function initiateAzamPayCheckout(params: {
  planId: Exclude<SubscriptionPlanId, 'free'>;
  provider: AzamPayProviderCode;
  phoneOrAccount: string;
  amountTzs?: number;
  displayCurrency?: SupportedCurrency;
  merchantMobileNumber?: string;
  otp?: string;
  turnstileToken?: string;
  turnstileBypassReason?: 'timeout_or_mobile_challenge';
}): Promise<AzamPayCheckoutResult> {
  const session = await waitForAuthReady();
  if (!session) {
    return { ok: false, error: 'Please sign in before starting AzamPay checkout.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: 'Billing service is temporarily unavailable.' };
  }

  const tier: AzamPayTierSlug =
    params.planId === 'enterprise' ? 'institutional_jv' : 'operator_pro';
  const matchedPlan =
    cachedPlans.find((p) => p.id === params.planId) ??
    CANONICAL_SUBSCRIPTION_PLANS.find((p) => p.id === params.planId);
  const forcedAmountTzs = resolveForcedTzsAmountForPlan(
    params.planId,
    params.amountTzs ?? matchedPlan?.price_tzs,
    matchedPlan?.price_usd,
  );
  const isBank =
    params.provider === 'CRDB' ||
    params.provider === 'NMB' ||
    params.provider === 'NBC';

  const cleanInput = params.phoneOrAccount.trim();
  if (!isBank) {
    const digits = cleanInput.replace(/[^0-9]/g, '');
    if (digits.length < 9 || digits.length > 12) {
      return {
        ok: false,
        error: 'Enter a valid Tanzania Mobile Money number (e.g. 07XX XXX XXX).',
      };
    }
  } else if (cleanInput.length < 4) {
    return {
      ok: false,
      error: 'Enter a valid bank account number (at least 4 characters).',
    };
  }

  try {
    let {
      data: { session: liveSession },
    } = await supabase.auth.getSession();

    if (!liveSession?.access_token) {
      const refreshed = await supabase.auth.refreshSession();
      liveSession = refreshed.data.session;
    }

    const userAccessToken = liveSession?.access_token?.trim();
    if (!userAccessToken) {
      return {
        ok: false,
        error: 'User Auth Error: Your session expired. Please sign in again before paying.',
      };
    }

    const { data, error } = await supabase.functions.invoke<AzamPayCheckoutResult>(
      'azampay-checkout',
      {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
        },
        body: {
          tier,
          planId: params.planId,
          provider: params.provider,
          currency: 'TZS',
          amountTzs: forcedAmountTzs,
          displayCurrency: params.displayCurrency || 'TZS',
          phoneNumber: !isBank ? cleanInput : undefined,
          accountNumber: isBank ? cleanInput : undefined,
          merchantMobileNumber: params.merchantMobileNumber?.trim() || undefined,
          otp: params.otp?.trim() || undefined,
          turnstileToken: params.turnstileToken || undefined,
          turnstileBypassReason: params.turnstileBypassReason || undefined,
        },
      },
    );

    if (error) {
      let extractedError = data?.error || error.message;
      const errWithCtx = error as unknown as { context?: Response };
      if (errWithCtx?.context && typeof errWithCtx.context.json === 'function') {
        try {
          const parsedBody = (await errWithCtx.context.json()) as {
            error?: string;
            message?: string;
          };
          if (parsedBody?.error || parsedBody?.message) {
            extractedError = parsedBody.error || parsedBody.message || extractedError;
          }
        } catch {
          // keep default error text
        }
      }
      return {
        ok: false,
        error: formatSafeUserError(
          extractedError,
          'Could not initiate AzamPay payment prompt right now. Please check your details and try again.',
        ),
      };
    }

    if (!data?.ok || !data?.externalId) {
      return {
        ok: false,
        error: formatSafeUserError(
          data?.error,
          'AzamPay could not initiate the payment prompt. Please try again.',
        ),
      };
    }

    recordAuditActivity({
      userId: session.user.id,
      action: 'AZAMPAY_CHECKOUT_INITIATED',
      metadata: {
        externalId: data.externalId,
        provider: params.provider,
        tier,
        amountTzs: data.amountTzs,
      },
    });

    return data;
  } catch (err) {
    return {
      ok: false,
      error: formatSafeUserError(
        err instanceof Error ? err.message : undefined,
        'Unable to reach AzamPay checkout service. Please try again.',
      ),
    };
  }
}

/**
 * Polls `public.payment_transactions` for the user's transaction status (`pending` | `completed` | `failed`).
 */
export async function fetchAzamPayTransactionStatus(
  externalId: string,
): Promise<AzamPayTransactionStatus | null> {
  const supabase = getSupabaseClient();
  if (!supabase || !externalId) return null;

  const { data, error } = await supabase
    .from('payment_transactions')
    .select(
      'id, external_id, status, provider, amount_tzs, tier, azampay_transaction_id, updated_at',
    )
    .eq('external_id', externalId)
    .maybeSingle();

  if (error || !data) return null;

  const normalizedStatus =
    data.status === 'completed' || data.status === 'failed'
      ? data.status
      : 'pending';

  return {
    id: String(data.id),
    external_id: String(data.external_id ?? externalId),
    status: normalizedStatus,
    provider: typeof data.provider === 'string' ? data.provider : null,
    amount_tzs: Number(data.amount_tzs ?? 0),
    tier: typeof data.tier === 'string' ? data.tier : null,
    azampay_transaction_id:
      typeof data.azampay_transaction_id === 'string'
        ? data.azampay_transaction_id
        : null,
    updated_at: String(data.updated_at ?? new Date().toISOString()),
  };
}

/**
 * Subscribes via Supabase Realtime to `payment_transactions` updates for `externalId`
 * so the checkout UI unlocks immediately when `azampay-callback` confirms settlement.
 */
export function subscribeToAzamPayTransaction(
  externalId: string,
  onStatusChange: (tx: AzamPayTransactionStatus) => void,
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase || !externalId) return () => {};

  const channel = supabase
    .channel(`azampay-tx-${externalId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'payment_transactions',
        filter: `external_id=eq.${externalId}`,
      },
      (payload) => {
        const row = (payload.new ?? {}) as Record<string, unknown>;
        const normalizedStatus =
          row.status === 'completed' || row.status === 'failed'
            ? row.status
            : 'pending';
        onStatusChange({
          id: String(row.id ?? ''),
          external_id: String(row.external_id ?? externalId),
          status: normalizedStatus,
          provider: typeof row.provider === 'string' ? row.provider : null,
          amount_tzs: Number(row.amount_tzs ?? 0),
          tier: typeof row.tier === 'string' ? row.tier : null,
          azampay_transaction_id:
            typeof row.azampay_transaction_id === 'string'
              ? row.azampay_transaction_id
              : null,
          updated_at: String(row.updated_at ?? new Date().toISOString()),
        });
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * Refreshes user subscription & entitlements immediately after webhook settlement
 * and broadcasts `SUBSCRIPTION_UPDATED_EVENT` to all mounted views.
 */
export async function syncSubscriptionAfterPayment(): Promise<void> {
  const session = await waitForAuthReady();
  if (!session) return;
  await fetchUserSubscriptionFromSupabase(
    session.user.id,
    session.user.email,
    session.user.role === 'admin',
  );
  broadcastSubscriptionUpdate();
}

/**
 * Admin Governance: Fetch All Plans, Pending/Historical Payments, & Active Subscriptions
 */
export async function fetchAdminBillingData(): Promise<{
  plans: SubscriptionPlanRecord[];
  payments: Array<SubscriptionPaymentRecord & { user_email?: string; user_name?: string }>;
  subscriptions: Array<UserSubscriptionRecord & { user_email?: string; user_name?: string }>;
  accountsLedger: AdminAccountLedgerRow[];
  error?: string;
}> {
  const session = await waitForAuthReady();
  if (!session || session.user.role !== 'admin') {
    return {
      plans: cachedPlans,
      payments: [],
      subscriptions: [],
      accountsLedger: [],
      error: '403 Forbidden: Administrative clearance required.',
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      plans: cachedPlans,
      payments: [],
      subscriptions: [],
      accountsLedger: [],
      error: 'Supabase client unavailable.',
    };
  }

  const [plansRes, paymentsRes, subsRes, profilesRes, ledgerRes] =
    await Promise.all([
      supabase
        .from('subscription_plans')
        .select('*')
        .order('sort_order', { ascending: true }),
      supabase
        .from('subscription_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('user_subscriptions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(100),
      supabase.from('profiles').select('id, email, full_name, created_at').limit(500),
      supabase.rpc('get_accounts_billing_ledger'),
    ]);

  const profileMap = new Map<
    string,
    { email: string; full_name: string | null; created_at?: string }
  >();
  if (Array.isArray(profilesRes.data)) {
    for (const p of profilesRes.data) {
      profileMap.set(p.id, {
        email: p.email,
        full_name: p.full_name,
        created_at: p.created_at,
      });
    }
  }

  const plans: SubscriptionPlanRecord[] =
    !plansRes.error && Array.isArray(plansRes.data) && plansRes.data.length > 0
      ? (plansRes.data as SubscriptionPlanRecord[])
      : [...CANONICAL_SUBSCRIPTION_PLANS];

  const payments = (
    Array.isArray(paymentsRes.data)
      ? (paymentsRes.data as SubscriptionPaymentRecord[])
      : []
  ).map((pay) => {
    const prof = profileMap.get(pay.user_id);
    return {
      ...pay,
      user_email: prof?.email,
      user_name: prof?.full_name ?? undefined,
    };
  });

  const subscriptions = (
    Array.isArray(subsRes.data)
      ? (subsRes.data as UserSubscriptionRecord[])
      : []
  ).map((sub) => {
    const prof = profileMap.get(sub.user_id);
    return {
      ...sub,
      user_email: prof?.email,
      user_name: prof?.full_name ?? undefined,
    };
  });

  // Authoritative Active / Dormant / Free Accounts Ledger (RPC with clean client-join fallback)
  let accountsLedger: AdminAccountLedgerRow[];
  if (!ledgerRes.error && Array.isArray(ledgerRes.data)) {
    accountsLedger = (ledgerRes.data as AdminAccountLedgerRow[]).map((row) => ({
      ...row,
      plan_id: normalizePlanId(row.plan_id),
      account_state:
        row.account_state === 'active' ||
        row.account_state === 'dormant' ||
        row.account_state === 'free'
          ? row.account_state
          : 'free',
      total_payments: Number(row.total_payments) || 0,
    }));
  } else {
    const subByUser = new Map<string, UserSubscriptionRecord>();
    subscriptions.forEach((s) => subByUser.set(s.user_id, s));
    const paysByUser = new Map<string, SubscriptionPaymentRecord[]>();
    payments.forEach((p) => {
      const list = paysByUser.get(p.user_id) ?? [];
      list.push(p);
      paysByUser.set(p.user_id, list);
    });

    const planNameMap = new Map<string, string>(plans.map((p) => [p.id, p.name]));

    accountsLedger = Array.from(profileMap.entries()).map(([uid, prof]) => {
      const sub = subByUser.get(uid);
      const userPays = paysByUser.get(uid) ?? [];
      const paidPays = userPays.filter(
        (p) =>
          p.plan_id !== 'free' &&
          (p.status === 'settled' || p.status === 'approved'),
      );
      const subPlanId = sub
        ? normalizePlanId(sub.plan_id ?? sub.tier_name)
        : paidPays[0]
          ? normalizePlanId(paidPays[0].plan_id)
          : 'free';
      const expiresMs = sub?.expires_at ? Date.parse(sub.expires_at) : 0;
      const isUnexpired = Number.isFinite(expiresMs) && expiresMs > Date.now();

      const account_state: AccountBillingState =
        sub && subPlanId !== 'free' && sub.status === 'active' && isUnexpired
          ? 'active'
          : (sub && subPlanId !== 'free') || paidPays.length > 0
            ? 'dormant'
            : 'free';

      return {
        user_id: uid,
        email: prof.email,
        full_name: prof.full_name,
        account_state,
        plan_id: subPlanId,
        plan_name:
          planNameMap.get(subPlanId) ??
          sub?.tier_name ??
          (subPlanId === 'enterprise'
            ? 'Institutional / JV Desk'
            : subPlanId === 'pro'
              ? 'Operator Pro'
              : 'Explorer'),
        payment_method:
          sub?.payment_method ??
          userPays[0]?.payment_method ??
          'Free Tier',
        payment_reference:
          sub?.payment_reference ?? userPays[0]?.reference_code ?? null,
        starts_at: sub?.starts_at ?? sub?.created_at ?? null,
        expires_at: sub?.expires_at ?? null,
        total_payments: paidPays.length,
      };
    });

    const stateOrder: Record<AccountBillingState, number> = {
      active: 0,
      dormant: 1,
      free: 2,
    };
    accountsLedger.sort(
      (a, b) => stateOrder[a.account_state] - stateOrder[b.account_state],
    );
  }

  const warningError =
    plansRes.error?.message ||
    paymentsRes.error?.message ||
    subsRes.error?.message;

  return {
    plans,
    payments,
    subscriptions,
    accountsLedger,
    error: warningError,
  };
}

/**
 * Admin Action: Approve & Activate (30 days) or Reject a Subscription Payment
 */
export async function adminReviewSubscriptionPayment(params: {
  paymentId: string;
  decision: 'approved' | 'rejected';
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await waitForAuthReady();
  if (!session || session.user.role !== 'admin') {
    return { ok: false, error: '403 Forbidden: Administrative clearance required.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: 'Supabase client unavailable.' };
  }

  const { error } = await supabase.rpc('admin_review_subscription_payment', {
    p_payment_id: params.paymentId,
    p_decision: params.decision,
    p_notes: params.notes?.trim() || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  broadcastSubscriptionUpdate();
  return { ok: true };
}

/**
 * Admin Action: Edit Subscription Plan Pricing & Entitlement Limits
 */
export async function adminUpdateSubscriptionPlan(
  planId: SubscriptionPlanId,
  updates: Partial<
    Pick<
      SubscriptionPlanRecord,
      | 'name'
      | 'tagline'
      | 'price_tzs'
      | 'price_usd'
      | 'max_active_listings'
      | 'max_monthly_rfqs'
      | 'can_access_data_room'
      | 'can_export_markets'
      | 'is_active'
    >
  >,
): Promise<{ ok: boolean; error?: string }> {
  const session = await waitForAuthReady();
  if (!session || session.user.role !== 'admin') {
    return { ok: false, error: '403 Forbidden: Administrative clearance required.' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: 'Supabase client unavailable.' };
  }

  const { error } = await supabase
    .from('subscription_plans')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await fetchSubscriptionPlans();
  broadcastSubscriptionUpdate();
  return { ok: true };
}

/**
 * Authoritative React Hook (`useSubscription()`)
 * Synchronizes active subscription plans, database-verified entitlements,
 * remaining quotas, and header tier badge across the application.
 */
export function useSubscription() {
  const session = useAuthSession();
  const userId = session?.user.id ?? null;
  const userEmail = session?.user.email ?? null;
  const isAdmin =
    session?.user.role === 'admin' ||
    (userEmail ?? '').trim().toLowerCase() === 'salminmwenesi@gmail.com';

  const [plans, setPlans] = useState<SubscriptionPlanRecord[]>(() =>
    getCachedSubscriptionPlans(),
  );
  const [subscription, setSubscription] = useState<UserSubscriptionRecord>(() =>
    getUserSubscription(userId),
  );
  const [entitlements, setEntitlements] = useState<UserEntitlements>(() =>
    userId
      ? (entitlementsCache.get(userId) ?? createDefaultEntitlements(isAdmin))
      : createDefaultEntitlements(false),
  );
  const [payments, setPayments] = useState<SubscriptionPaymentRecord[]>(() =>
    getUserSubscriptionPayments(userId),
  );
  const [transactions, setTransactions] = useState<PaymentTransactionRecord[]>(
    () => getUserPaymentTransactions(userId),
  );
  const [loading, setLoading] = useState<boolean>(Boolean(userId));

  const refreshSubscription = useCallback(async () => {
    if (!userId) {
      const loadedPlans = await fetchSubscriptionPlans();
      setPlans(loadedPlans);
      setSubscription(createDefaultExplorerSubscription(null));
      setEntitlements(createDefaultEntitlements(false));
      setPayments([]);
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetchUserSubscriptionFromSupabase(
        userId,
        userEmail,
        isAdmin,
      );
      setPlans(res.plans);
      setSubscription(res.subscription);
      setEntitlements(res.entitlements);
      setPayments(res.payments);
      setTransactions(res.transactions);
    } finally {
      setLoading(false);
    }
  }, [userId, userEmail, isAdmin]);

  useEffect(() => {
    void refreshSubscription();

    const handleSync = () => {
      void refreshSubscription();
    };

    window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, handleSync);
    return () => {
      window.removeEventListener(SUBSCRIPTION_UPDATED_EVENT, handleSync);
    };
  }, [refreshSubscription]);

  const activePlan = useMemo(
    () =>
      plans.find((p) => p.id === entitlements.plan_id) ??
      CANONICAL_SUBSCRIPTION_PLANS[0],
    [plans, entitlements.plan_id],
  );

  const pendingPayment = useMemo(
    () => payments.find((p) => p.status === 'pending_verification') ?? null,
    [payments],
  );

  const tierConfig = useMemo(() => {
    const mappedName: SubscriptionTierName =
      entitlements.plan_id === 'enterprise'
        ? 'Institutional / JV Desk'
        : entitlements.plan_id === 'pro'
          ? 'Operator Pro'
          : 'Explorer';
    const base = SUBSCRIPTION_TIERS[mappedName];
    return {
      ...base,
      monthlyTzs: activePlan.price_tzs,
      monthlyUsd: activePlan.price_usd,
      tagline: activePlan.tagline,
      quotas: {
        ...base.quotas,
        maxProjectListings:
          activePlan.max_active_listings < 0
            ? 999
            : activePlan.max_active_listings,
        maxMonthlyRfqs:
          activePlan.max_monthly_rfqs < 0 ? 999 : activePlan.max_monthly_rfqs,
      },
      permissions: {
        ...base.permissions,
        canListProject:
          entitlements.is_paid_active &&
          (activePlan.max_active_listings < 0 ||
            activePlan.max_active_listings > 0),
        canAccessDealRoom: entitlements.can_access_data_room,
        canExportMarkets: entitlements.can_export_markets,
      },
    };
  }, [entitlements, activePlan]);

  const canCreateListing = useMemo(() => {
    if (!entitlements.is_paid_active) return false;
    if (entitlements.max_active_listings < 0) return true;
    return entitlements.active_listings_count < entitlements.max_active_listings;
  }, [entitlements]);

  const canSubmitRfq = useMemo(() => {
    if (!entitlements.is_paid_active) return false;
    if (entitlements.max_monthly_rfqs < 0) return true;
    return entitlements.monthly_rfqs_count < entitlements.max_monthly_rfqs;
  }, [entitlements]);

  const hasMinimumTier = useCallback(
    (requiredTier: SubscriptionTierName): boolean => {
      const requiredRank = SUBSCRIPTION_TIERS[requiredTier]?.rank ?? 0;
      if (requiredRank === 0) return true;
      return entitlements.is_paid_active && tierConfig.rank >= requiredRank;
    },
    [entitlements.is_paid_active, tierConfig.rank],
  );

  const checkQuota = useCallback(
    (
      quotaKey: keyof TierQuotas,
      currentUsed: number,
    ): {
      allowed: boolean;
      limit: number;
      used: number;
      remaining: number;
      usagePercent: number;
    } => {
      const limit = tierConfig.quotas[quotaKey];
      const remaining = limit >= 999 ? 999 : Math.max(0, limit - currentUsed);
      const needsPaid =
        quotaKey === 'maxProjectListings' ||
        quotaKey === 'maxMonthlyRfqs' ||
        quotaKey === 'maxOpportunityListings' ||
        quotaKey === 'maxServiceListings';
      const allowed =
        (!needsPaid || entitlements.is_paid_active) &&
        (limit >= 999 || currentUsed < limit);
      const usagePercent =
        limit === 0
          ? 100
          : limit >= 999
            ? Math.min(100, Math.round((currentUsed / 25) * 100))
            : Math.min(100, Math.round((currentUsed / limit) * 100));

      return {
        allowed,
        limit,
        used: currentUsed,
        remaining,
        usagePercent,
      };
    },
    [entitlements.is_paid_active, tierConfig.quotas],
  );

  const headerTierLabel = getPlanHeaderLabel(entitlements.plan_id);

  return {
    loading,
    plans,
    plan: activePlan,
    planId: entitlements.plan_id,
    entitlements,
    subscription,
    pendingPayment,
    payments,
    tierConfig,
    tierName: headerTierLabel,
    accountState: entitlements.account_state,
    isPaidActive: entitlements.is_paid_active,
    isExpired: entitlements.account_state === 'dormant' || entitlements.status === 'expired',
    canCreateListing,
    canSubmitRfq,
    canAccessDataRoom: entitlements.can_access_data_room,
    canExportMarkets: entitlements.can_export_markets,
    quotas: tierConfig.quotas,
    permissions: tierConfig.permissions,
    transactions,
    hasMinimumTier,
    checkQuota,
    refreshSubscription,
  };
}
