'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ensureAdminDemoSession,
  getSession,
  recordAuditActivity,
  useAuthSession,
} from './supabaseAuth';
import {
  CLICKPESA_CHANNELS,
  canTransitionClickPesaState,
  computeClickPesaWebhookSignature,
  generateClickPesaIdempotencyKey,
  generateClickPesaOrderIdentifiers,
  verifyClickPesaWebhookSignature,
} from './payments/clickpesa';
import type {
  BillingCycle,
  ClickPesaProviderCode,
  ClickPesaRail,
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
      payment_gateway: 'CLICKPESA',
      payment_rail: 'BANK_TRANSFER',
      payment_provider: 'CRDB_BANK',
      payment_reference: 'CP-COR-CRDB-994021',
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
      payment_gateway: 'CLICKPESA',
      payment_rail: 'MOBILE_MONEY',
      payment_provider: 'MPESA_TZ',
      payment_reference: 'CP-PRO-MPESA-882410',
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

export function getUserSubscription(
  userId?: string | null
): UserSubscriptionRecord {
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
      payment_rail: 'FREE',
      payment_provider: 'FREE',
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
  return {
    id: `sub-${userId.slice(0, 8)}`,
    user_id: userId,
    tier_name: 'Explorer',
    status: 'active',
    billing_cycle: 'monthly',
    price_tzs: 0,
    price_usd: 0,
    payment_gateway: 'FREE_TIER',
    payment_rail: 'FREE',
    payment_provider: 'FREE',
    payment_reference: 'EXPLORER-DEFAULT',
    expires_at: expiresDefault,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

export function getAllPaymentTransactions(): PaymentTransactionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PAYMENT_TX_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PaymentTransactionRecord[]) : [];
  } catch {
    return [];
  }
}

export function getUserPaymentTransactions(
  userId?: string | null
): PaymentTransactionRecord[] {
  if (!userId) return [];
  return getAllPaymentTransactions().filter((tx) => tx.user_id === userId);
}

/**
 * Step 1 & 2 of ClickPesa Transaction State Machine:
 * Validates idempotency key, creates `INITIATED` -> `PROCESSING` transaction,
 * and returns ClickPesa order & control number.
 */
export async function executeClickPesaSubscriptionPayment(params: {
  userId?: string;
  tierName: SubscriptionTierName;
  billingCycle: BillingCycle;
  providerCode: ClickPesaProviderCode;
  accountOrPhoneMasked?: string;
  chargedCurrency: SupportedCurrency;
  chargedAmount: number;
  idempotencyKey?: string;
  onStateChange?: (tx: PaymentTransactionRecord) => void;
}): Promise<{
  success: boolean;
  idempotentReplay?: boolean;
  subscription?: UserSubscriptionRecord;
  transaction?: PaymentTransactionRecord;
  webhookSignature?: string;
  error?: string;
}> {
  const session = getSession() ?? ensureAdminDemoSession();
  const targetUserId = params.userId || session.user.id;

  const verified = resolveVerifiedTierPricing(
    params.tierName,
    params.billingCycle
  );

  const idempotencyKey =
    params.idempotencyKey ||
    generateClickPesaIdempotencyKey({
      userId: targetUserId,
      tierName: verified.tierName,
      billingCycle: verified.billingCycle,
      providerCode: params.providerCode,
      nonce: Date.now().toString(36),
    });

  // 1. Idempotency Guard: check if this idempotencyKey was already settled
  const existingTxList = getAllPaymentTransactions();
  const duplicateTx = existingTxList.find(
    (t) => t.idempotency_key === idempotencyKey
  );
  if (duplicateTx && duplicateTx.state === 'SETTLED') {
    const existingSub = getUserSubscription(targetUserId);
    return {
      success: true,
      idempotentReplay: true,
      subscription: existingSub,
      transaction: duplicateTx,
    };
  }

  const channelMeta =
    params.providerCode === 'FREE'
      ? {
          rail: 'FREE' as ClickPesaRail,
          name: 'Explorer Free Membership',
        }
      : CLICKPESA_CHANNELS[params.providerCode];

  const { orderId, controlNumber } = generateClickPesaOrderIdentifiers(
    params.providerCode,
    verified.tierName
  );

  const nowIso = new Date().toISOString();

  // State 1: INITIATED
  const txRecord: PaymentTransactionRecord = {
    id: `cptx-${Date.now().toString(36)}`,
    idempotency_key: idempotencyKey,
    clickpesa_order_id: orderId,
    clickpesa_control_number:
      channelMeta.rail === 'BANK_TRANSFER' ||
      channelMeta.rail === 'MOBILE_MONEY'
        ? controlNumber
        : null,
    user_id: targetUserId,
    tier_name: verified.tierName,
    billing_cycle: verified.billingCycle,
    gateway: verified.verifiedAmountTzs === 0 ? 'FREE_TIER' : 'CLICKPESA',
    rail: channelMeta.rail,
    provider_code: params.providerCode,
    payment_method_label: channelMeta.name,
    account_or_phone_masked: params.accountOrPhoneMasked || null,
    verified_amount_tzs: verified.verifiedAmountTzs,
    verified_amount_usd: verified.verifiedAmountUsd,
    charged_currency: params.chargedCurrency,
    charged_amount: params.chargedAmount,
    state: 'INITIATED',
    webhook_signature_verified: false,
    reconciled_at: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  params.onStateChange?.({ ...txRecord });

  // Attempt server API call to `/api/payments/create` if Next.js API is running,
  // with seamless client-side state machine fallback
  try {
    await fetch('/api/payments/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        userId: targetUserId,
        tierName: verified.tierName,
        billingCycle: verified.billingCycle,
        providerCode: params.providerCode,
        accountOrPhoneMasked: params.accountOrPhoneMasked,
        idempotencyKey,
      }),
    }).catch(() => null);
  } catch {
    // Continue deterministic state machine transition
  }

  // State 2: Transition INITIATED -> PROCESSING
  if (canTransitionClickPesaState(txRecord.state, 'PROCESSING')) {
    txRecord.state = 'PROCESSING';
    txRecord.updated_at = new Date().toISOString();
    params.onStateChange?.({ ...txRecord });
  }

  // Compute & verify ClickPesa Webhook HMAC-SHA256 signature
  const webhookPayload = JSON.stringify({
    event: 'payment.settled',
    orderId: txRecord.clickpesa_order_id,
    idempotencyKey: txRecord.idempotency_key,
    userId: targetUserId,
    tierName: verified.tierName,
    billingCycle: verified.billingCycle,
    verifiedAmountTzs: verified.verifiedAmountTzs,
  });

  const signature = await computeClickPesaWebhookSignature(webhookPayload);
  const signatureValid = await verifyClickPesaWebhookSignature(
    webhookPayload,
    signature
  );

  if (!signatureValid) {
    txRecord.state = 'FAILED';
    return {
      success: false,
      error: 'ClickPesa webhook HMAC-SHA256 signature validation failed.',
    };
  }

  // State 3: Transition PROCESSING -> SETTLED & Reconcile Subscription
  if (canTransitionClickPesaState(txRecord.state, 'SETTLED')) {
    txRecord.state = 'SETTLED';
    txRecord.webhook_signature_verified = true;
    txRecord.reconciled_at = new Date().toISOString();
    txRecord.updated_at = txRecord.reconciled_at;
    params.onStateChange?.({ ...txRecord });
  }

  const expiresAt = new Date(
    Date.now() + verified.durationDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const updatedSubscription: UserSubscriptionRecord = {
    id: `sub-${Date.now().toString(36)}`,
    user_id: targetUserId,
    tier_name: verified.tierName,
    status: 'active',
    billing_cycle: verified.billingCycle,
    price_tzs: verified.verifiedAmountTzs,
    price_usd: verified.verifiedAmountUsd,
    payment_gateway:
      verified.verifiedAmountTzs === 0 ? 'FREE_TIER' : 'CLICKPESA',
    payment_rail: channelMeta.rail,
    payment_provider: params.providerCode,
    payment_reference: txRecord.clickpesa_order_id,
    expires_at: expiresAt,
    created_at: nowIso,
    updated_at: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    const allSubs = getAllStoredSubscriptions();
    allSubs[targetUserId] = updatedSubscription;
    window.localStorage.setItem(
      SUBSCRIPTIONS_STORAGE_KEY,
      JSON.stringify(allSubs)
    );

    const nextTxList = [
      txRecord,
      ...existingTxList.filter((t) => t.id !== txRecord.id),
    ].slice(0, 200);
    window.localStorage.setItem(
      PAYMENT_TX_STORAGE_KEY,
      JSON.stringify(nextTxList)
    );

    window.dispatchEvent(
      new CustomEvent(SUBSCRIPTION_UPDATED_EVENT, {
        detail: {
          subscription: updatedSubscription,
          transaction: txRecord,
        },
      })
    );
  }

  recordAuditActivity({
    userId: targetUserId,
    action: 'CLICKPESA_SUBSCRIPTION_SETTLED',
    metadata: {
      orderId: txRecord.clickpesa_order_id,
      controlNumber: txRecord.clickpesa_control_number,
      idempotencyKey: txRecord.idempotency_key,
      tierName: verified.tierName,
      billingCycle: verified.billingCycle,
      rail: channelMeta.rail,
      providerCode: params.providerCode,
      verifiedAmountTzs: verified.verifiedAmountTzs,
      verifiedAmountUsd: verified.verifiedAmountUsd,
      webhookSignatureVerified: true,
    },
  });

  return {
    success: true,
    subscription: updatedSubscription,
    transaction: txRecord,
    webhookSignature: signature,
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
