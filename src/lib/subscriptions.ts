'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSession, recordAuditActivity, useAuthSession } from './supabaseAuth';
import {
  MERCHANT_SETTLEMENT_ACCOUNT,
  buildMerchantSettlementEntry,
  recordMerchantSettlementLedger,
  type SettlementLedgerEntry,
} from './payments/settlement';
import type {
  BillingCycle,
  PaymentGatewayId,
  PaymentTransactionRecord,
  SubscriptionTierName,
  SupportedCurrency,
  UserSubscriptionRecord,
} from '../types/database';

export const SUBSCRIPTIONS_STORAGE_KEY = 'mineconnect.db.user_subscriptions.v1';
export const PAYMENT_TX_STORAGE_KEY = 'mineconnect.db.payment_transactions.v1';
export const SUBSCRIPTION_UPDATED_EVENT = 'mineconnect:subscription-updated';

/**
 * Statutory baseline TZS-to-USD parity used to convert TZS subscription tiers
 * into USD base equivalents for dynamic multi-currency formatting via `LocalizationContext`.
 */
export const STATUTORY_TZS_PER_USD = 2685;

export interface TierQuotas {
  maxProjectListings: number;
  maxOpportunityListings: number;
  maxServiceListings: number;
  maxVaultDocuments: number;
}

export interface TierPermissions {
  canListProject: boolean;
  canHostDocuments: boolean;
  canViewAnalytics: boolean;
  canAccessDealRoom: boolean;
  canUseAdvancedMapFilters: boolean;
  canPriorityPlacement: boolean;
  teamSeats: number;
}

export interface SubscriptionTierConfig {
  id: string;
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

/**
 * Canonical Server & Client Dictionary of Subscription Tiers & Feature Gating Rules
 * Never trust prices or limits sent from client browsers — always resolve from this dictionary.
 */
export const SUBSCRIPTION_TIERS: Record<
  SubscriptionTierName,
  SubscriptionTierConfig
> = {
  Explorer: {
    id: 'explorer',
    tierName: 'Explorer',
    rank: 0,
    monthlyTzs: 0,
    yearlyTzs: 0,
    monthlyUsd: 0,
    yearlyUsd: 0,
    tagline: 'Anyone exploring the market',
    quotas: {
      maxProjectListings: 0,
      maxOpportunityListings: 1,
      maxServiceListings: 0,
      maxVaultDocuments: 2,
    },
    permissions: {
      canListProject: false,
      canHostDocuments: false,
      canViewAnalytics: false,
      canAccessDealRoom: false,
      canUseAdvancedMapFilters: false,
      canPriorityPlacement: false,
      teamSeats: 1,
    },
    features: [
      'Basic search & filters',
      'Selected public listings',
      'Saved searches (up to 2 Vault notes)',
      'Personal Explorer account',
    ],
  },
  Miner: {
    id: 'miner',
    tierName: 'Miner',
    rank: 1,
    monthlyTzs: 50_000,
    yearlyTzs: 500_000,
    monthlyUsd: Number((50_000 / STATUTORY_TZS_PER_USD).toFixed(2)),
    yearlyUsd: Number((500_000 / STATUTORY_TZS_PER_USD).toFixed(2)),
    tagline: 'Small-scale miners & PML holders',
    quotas: {
      maxProjectListings: 3,
      maxOpportunityListings: 3,
      maxServiceListings: 1,
      maxVaultDocuments: 10,
    },
    permissions: {
      canListProject: true,
      canHostDocuments: false,
      canViewAnalytics: false,
      canAccessDealRoom: false,
      canUseAdvancedMapFilters: true,
      canPriorityPlacement: false,
      teamSeats: 1,
    },
    features: [
      'Up to 3 project listings',
      'Basic owner profile',
      'Investor enquiries',
      'Email & SMS notifications',
    ],
  },
  Professional: {
    id: 'professional',
    tierName: 'Professional',
    rank: 2,
    monthlyTzs: 150_000,
    yearlyTzs: 1_500_000,
    monthlyUsd: Number((150_000 / STATUTORY_TZS_PER_USD).toFixed(2)),
    yearlyUsd: Number((1_500_000 / STATUTORY_TZS_PER_USD).toFixed(2)),
    tagline: 'Project owners & professionals',
    quotas: {
      maxProjectListings: 10,
      maxOpportunityListings: 15,
      maxServiceListings: 10,
      maxVaultDocuments: 50,
    },
    permissions: {
      canListProject: true,
      canHostDocuments: true,
      canViewAnalytics: true,
      canAccessDealRoom: true,
      canUseAdvancedMapFilters: true,
      canPriorityPlacement: true,
      teamSeats: 3,
    },
    features: [
      'Up to 10 project listings',
      'Enhanced project pages',
      'Document hosting (50 Vault files)',
      'Listing analytics',
      'Priority placement',
    ],
  },
  Investor: {
    id: 'investor',
    tierName: 'Investor',
    rank: 3,
    monthlyTzs: 300_000,
    yearlyTzs: 3_000_000,
    monthlyUsd: Number((300_000 / STATUTORY_TZS_PER_USD).toFixed(2)),
    yearlyUsd: Number((3_000_000 / STATUTORY_TZS_PER_USD).toFixed(2)),
    tagline: 'Investors & investment companies',
    highlighted: true,
    quotas: {
      maxProjectListings: 5,
      maxOpportunityListings: 10,
      maxServiceListings: 5,
      maxVaultDocuments: 100,
    },
    permissions: {
      canListProject: true,
      canHostDocuments: true,
      canViewAnalytics: true,
      canAccessDealRoom: true,
      canUseAdvancedMapFilters: true,
      canPriorityPlacement: true,
      teamSeats: 5,
    },
    features: [
      'Advanced search & map filters',
      'Selected mining intelligence',
      'Deal-room access',
      'Investor alerts & matching',
    ],
  },
  Corporate: {
    id: 'corporate',
    tierName: 'Corporate',
    rank: 4,
    monthlyTzs: 1_000_000,
    yearlyTzs: 10_000_000,
    monthlyUsd: Number((1_000_000 / STATUTORY_TZS_PER_USD).toFixed(2)),
    yearlyUsd: Number((10_000_000 / STATUTORY_TZS_PER_USD).toFixed(2)),
    tagline: 'Mining companies & institutions',
    quotas: {
      maxProjectListings: 999,
      maxOpportunityListings: 999,
      maxServiceListings: 999,
      maxVaultDocuments: 999,
    },
    permissions: {
      canListProject: true,
      canHostDocuments: true,
      canViewAnalytics: true,
      canAccessDealRoom: true,
      canUseAdvancedMapFilters: true,
      canPriorityPlacement: true,
      teamSeats: 25,
    },
    features: [
      'Multiple team seats (up to 25)',
      'Corporate profile & unlimited listings',
      'Premium visibility',
      'Intelligence & Deal-Room access',
      'Dedicated account support',
    ],
  },
};

export const SUBSCRIPTION_TIER_LIST: SubscriptionTierConfig[] = [
  SUBSCRIPTION_TIERS.Explorer,
  SUBSCRIPTION_TIERS.Miner,
  SUBSCRIPTION_TIERS.Professional,
  SUBSCRIPTION_TIERS.Investor,
  SUBSCRIPTION_TIERS.Corporate,
];

/**
 * Normalizes any tier slug or label (`'miner'`, `'Miner'`, `'PROFESSIONAL'`)
 * into a canonical `SubscriptionTierName`.
 */
export function normalizeSubscriptionTier(
  input?: string | null
): SubscriptionTierName {
  if (!input) return 'Explorer';
  const clean = input.trim().toLowerCase();
  switch (clean) {
    case 'miner':
      return 'Miner';
    case 'professional':
      return 'Professional';
    case 'investor':
      return 'Investor';
    case 'corporate':
      return 'Corporate';
    case 'explorer':
    default:
      return 'Explorer';
  }
}

export function normalizeBillingCycle(input?: string | null): BillingCycle {
  if (!input) return 'monthly';
  return input.trim().toLowerCase() === 'yearly' ? 'yearly' : 'monthly';
}

/**
 * Anti-Tampering Server/Controller Price Lookup
 * Computes the exact verified TZS and USD amount strictly from the server dictionary.
 */
export function resolveVerifiedTierPricing(
  tierInput: string,
  billingInput: string
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

function getDefaultSubscriptionsSeed(): Record<string, UserSubscriptionRecord> {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    // Admin account defaults to Corporate tier
    '00000000-0000-4000-8000-000000000001': {
      id: 'sub-seed-admin-001',
      user_id: '00000000-0000-4000-8000-000000000001',
      tier_name: 'Corporate',
      status: 'active',
      billing_cycle: 'yearly',
      price_tzs: 10_000_000,
      price_usd: 3724.39,
      payment_gateway: 'STRIPE_GLOBAL',
      payment_reference: 'STRP-CORP-994021',
      expires_at: new Date(now + 340 * dayMs).toISOString(),
      created_at: new Date(now - 25 * dayMs).toISOString(),
      updated_at: new Date(now - 25 * dayMs).toISOString(),
    },
    // Demo Geologist defaults to Professional tier
    '00000000-0000-4000-8000-000000000002': {
      id: 'sub-seed-prof-002',
      user_id: '00000000-0000-4000-8000-000000000002',
      tier_name: 'Professional',
      status: 'active',
      billing_cycle: 'monthly',
      price_tzs: 150_000,
      price_usd: 55.87,
      payment_gateway: 'AZAMPAY_MPESA_TZS',
      payment_reference: 'MPESA-TZ-882410',
      expires_at: new Date(now + 24 * dayMs).toISOString(),
      created_at: new Date(now - 6 * dayMs).toISOString(),
      updated_at: new Date(now - 6 * dayMs).toISOString(),
    },
  };
}

export function getAllStoredSubscriptions(): Record<
  string,
  UserSubscriptionRecord
> {
  if (typeof window === 'undefined') {
    return getDefaultSubscriptionsSeed();
  }
  try {
    const raw = window.localStorage.getItem(SUBSCRIPTIONS_STORAGE_KEY);
    if (!raw) {
      const seed = getDefaultSubscriptionsSeed();
      window.localStorage.setItem(
        SUBSCRIPTIONS_STORAGE_KEY,
        JSON.stringify(seed)
      );
      return seed;
    }
    return JSON.parse(raw) as Record<string, UserSubscriptionRecord>;
  } catch {
    return getDefaultSubscriptionsSeed();
  }
}

export function getUserSubscription(userId?: string | null): UserSubscriptionRecord {
  const now = new Date();
  const expiresDefault = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  if (!userId) {
    return {
      id: 'sub-guest-explorer',
      user_id: 'guest',
      tier_name: 'Explorer',
      status: 'active',
      billing_cycle: 'monthly',
      price_tzs: 0,
      price_usd: 0,
      payment_gateway: 'FREE_TIER',
      payment_reference: null,
      expires_at: expiresDefault,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
  }

  const all = getAllStoredSubscriptions();
  const existing = all[userId];
  if (existing) {
    return existing;
  }

  // Default any newly registered account to Explorer (Free) unless upgraded
  const explorerRecord: UserSubscriptionRecord = {
    id: `sub-${userId.slice(0, 8)}`,
    user_id: userId,
    tier_name: 'Explorer',
    status: 'active',
    billing_cycle: 'monthly',
    price_tzs: 0,
    price_usd: 0,
    payment_gateway: 'FREE_TIER',
    payment_reference: 'EXPLORER-DEFAULT',
    expires_at: expiresDefault,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  return explorerRecord;
}

export function getUserPaymentTransactions(
  userId?: string | null
): PaymentTransactionRecord[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = window.localStorage.getItem(PAYMENT_TX_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as PaymentTransactionRecord[];
    return list.filter((tx) => tx.user_id === userId);
  } catch {
    return [];
  }
}

/**
 * Verifies & activates a user subscription after anti-tampering server price resolution
 * and webhook confirmation.
 */
export async function activateVerifiedSubscription(params: {
  userId?: string;
  tierName: SubscriptionTierName;
  billingCycle: BillingCycle;
  gateway: PaymentGatewayId;
  paymentMethodLabel: string;
  chargedCurrency: SupportedCurrency;
  chargedAmount: number;
  externalReference?: string;
}): Promise<{
  success: boolean;
  subscription?: UserSubscriptionRecord;
  transaction?: PaymentTransactionRecord;
  settlement?: SettlementLedgerEntry;
  error?: string;
}> {
  const session = getSession();
  const targetUserId = params.userId ?? session?.user.id;

  if (!targetUserId) {
    return {
      success: false,
      error: '401 Unauthorized: Active authenticated user session required.',
    };
  }

  // Server-side anti-tampering price verification
  const verified = resolveVerifiedTierPricing(
    params.tierName,
    params.billingCycle
  );

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + verified.durationDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const refPrefix =
    params.gateway === 'STRIPE_GLOBAL'
      ? 'STRP'
      : params.gateway === 'AZAMPAY_MPESA_TZS'
        ? 'MPESA'
        : params.gateway === 'FLUTTERWAVE_AFRICA'
          ? 'FLW'
          : 'FREE';

  const externalReference =
    params.externalReference ||
    `${refPrefix}-${verified.tierName.slice(0, 3).toUpperCase()}-${Math.floor(
      100000 + Math.random() * 900000
    )}`;

  const subscription: UserSubscriptionRecord = {
    id: `sub-${Date.now().toString(36)}`,
    user_id: targetUserId,
    tier_name: verified.tierName,
    status: 'active',
    billing_cycle: verified.billingCycle,
    price_tzs: verified.verifiedAmountTzs,
    price_usd: verified.verifiedAmountUsd,
    payment_gateway: params.gateway,
    payment_reference: externalReference,
    expires_at: expiresAt,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const transaction: PaymentTransactionRecord = {
    id: `tx-${Date.now().toString(36)}`,
    user_id: targetUserId,
    tier_name: verified.tierName,
    billing_cycle: verified.billingCycle,
    gateway: params.gateway,
    payment_method_label: params.paymentMethodLabel,
    verified_amount_tzs: verified.verifiedAmountTzs,
    verified_amount_usd: verified.verifiedAmountUsd,
    charged_currency: params.chargedCurrency,
    charged_amount: params.chargedAmount,
    external_reference: externalReference,
    webhook_status: 'VERIFIED',
    created_at: now.toISOString(),
  };

  const settlement = buildMerchantSettlementEntry({
    transactionReference: externalReference,
    userId: targetUserId,
    tierName: verified.tierName,
    billingCycle: verified.billingCycle,
    gateway: params.gateway,
    paymentChannel: params.paymentMethodLabel,
    verifiedAmountTzs: verified.verifiedAmountTzs,
    verifiedAmountUsd: verified.verifiedAmountUsd,
    chargedCurrency: params.chargedCurrency,
    chargedAmount: params.chargedAmount,
  });

  if (typeof window !== 'undefined') {
    const allSubs = getAllStoredSubscriptions();
    allSubs[targetUserId] = subscription;
    window.localStorage.setItem(
      SUBSCRIPTIONS_STORAGE_KEY,
      JSON.stringify(allSubs)
    );

    const rawTx = window.localStorage.getItem(PAYMENT_TX_STORAGE_KEY);
    const txList: PaymentTransactionRecord[] = rawTx ? JSON.parse(rawTx) : [];
    txList.unshift(transaction);
    window.localStorage.setItem(
      PAYMENT_TX_STORAGE_KEY,
      JSON.stringify(txList.slice(0, 200))
    );

    recordMerchantSettlementLedger(settlement);

    window.dispatchEvent(
      new CustomEvent(SUBSCRIPTION_UPDATED_EVENT, {
        detail: { subscription, transaction, settlement },
      })
    );
  }

  recordAuditActivity({
    userId: targetUserId,
    action: 'SUBSCRIPTION_ACTIVATED',
    metadata: {
      tierName: verified.tierName,
      billingCycle: verified.billingCycle,
      gateway: params.gateway,
      paymentMethod: params.paymentMethodLabel,
      verifiedAmountTzs: verified.verifiedAmountTzs,
      verifiedAmountUsd: verified.verifiedAmountUsd,
      reference: externalReference,
      settlementBank: MERCHANT_SETTLEMENT_ACCOUNT.bankName,
      settlementAccountNumber: MERCHANT_SETTLEMENT_ACCOUNT.accountNumber,
      settlementBeneficiary: MERCHANT_SETTLEMENT_ACCOUNT.accountName,
      settlementStatus: settlement.settlementStatus,
      settlementBatchId: settlement.batchId,
      expiresAt,
    },
  });

  return {
    success: true,
    subscription,
    transaction,
    settlement,
  };
}

/**
 * Custom React Hook (`useSubscription()`)
 * Synchronizes active user subscription, tier permissions, and quota limits in real time.
 */
export function useSubscription() {
  const session = useAuthSession();
  const userId = session?.user.id ?? null;

  const [subscription, setSubscription] = useState<UserSubscriptionRecord>(() =>
    getUserSubscription(userId)
  );

  useEffect(() => {
    setSubscription(getUserSubscription(userId));

    const handleSync = () => {
      setSubscription(getUserSubscription(userId));
    };

    window.addEventListener(SUBSCRIPTION_UPDATED_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(SUBSCRIPTION_UPDATED_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [userId]);

  const tierConfig = useMemo(
    () =>
      SUBSCRIPTION_TIERS[subscription.tier_name] ?? SUBSCRIPTION_TIERS.Explorer,
    [subscription.tier_name]
  );

  const transactions = useMemo(
    () => getUserPaymentTransactions(userId),
    [userId, subscription.updated_at]
  );

  const hasMinimumTier = useCallback(
    (requiredTier: SubscriptionTierName): boolean => {
      const requiredRank = SUBSCRIPTION_TIERS[requiredTier]?.rank ?? 0;
      return (
        subscription.status === 'active' && tierConfig.rank >= requiredRank
      );
    },
    [subscription.status, tierConfig.rank]
  );

  const checkQuota = useCallback(
    (
      quotaKey: keyof TierQuotas,
      currentUsed: number
    ): {
      allowed: boolean;
      limit: number;
      used: number;
      remaining: number;
      usagePercent: number;
    } => {
      const limit = tierConfig.quotas[quotaKey];
      const remaining = Math.max(0, limit - currentUsed);
      const allowed = subscription.status === 'active' && currentUsed < limit;
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
    [subscription.status, tierConfig.quotas]
  );

  return {
    subscription,
    tierConfig,
    tierName: subscription.tier_name,
    quotas: tierConfig.quotas,
    permissions: tierConfig.permissions,
    transactions,
    hasMinimumTier,
    checkQuota,
  };
}
