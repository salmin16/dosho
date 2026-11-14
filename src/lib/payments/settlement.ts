/**
 * Sanitized Settlement Ledger & Payment Operator Types (`src/lib/payments/settlement.ts`)
 *
 * PRIVACY & SECURITY INVARIANT:
 * - Zero merchant bank names, bank account numbers, or beneficiary names exist in this module.
 * - All merchant payout coordinates live strictly underground in server-only environment
 *   variables inside `src/lib/payments/config.ts`.
 */

import { buildUndergroundGatewaySplitMetadata } from './config';
import type {
  BillingCycle,
  PaymentGatewayId,
  SubscriptionTierName,
  SupportedCurrency,
} from '../../types/database';

export type SettlementStatus = 'settled' | 'pending_payout';

export type MobileMoneyOperatorId =
  | 'airtel_money'
  | 'mixx_by_yas'
  | 'halopesa'
  | 'azampesa'
  | 'mpesa'
  | 'tpesa'
  | 'card_redirect';

export type InternationalPaymentMethodId =
  | 'apple_pay'
  | 'google_pay'
  | 'credit_debit_card';

/**
 * Sanitized Settlement Receipt Entry (contains zero banking coordinates or beneficiary PII).
 */
export interface SettlementLedgerEntry {
  settlementId: string;
  batchId: string;
  transactionReference: string;
  userId: string;
  tierName: SubscriptionTierName;
  billingCycle: BillingCycle;
  gateway: PaymentGatewayId;
  paymentChannel: string;
  grossAmountTzs: number;
  grossAmountUsd: number;
  chargedCurrency: SupportedCurrency;
  chargedAmount: number;
  settlementStatus: SettlementStatus;
  settledAt: string;
  createdAt: string;
}

const SETTLEMENT_LEDGER_STORAGE_KEY =
  'mineconnect.db.sanitized_settlement_ledger.v2';

/**
 * Builds a sanitized settlement confirmation record while keeping all merchant
 * bank routing strictly underground on the backend.
 */
export function buildMerchantSettlementEntry(params: {
  transactionReference: string;
  userId: string;
  tierName: SubscriptionTierName;
  billingCycle: BillingCycle;
  gateway: PaymentGatewayId;
  paymentChannel: string;
  verifiedAmountTzs: number;
  verifiedAmountUsd: number;
  chargedCurrency: SupportedCurrency;
  chargedAmount: number;
}): SettlementLedgerEntry {
  const nowIso = new Date().toISOString();

  const splitMeta = buildUndergroundGatewaySplitMetadata({
    gateway: params.gateway,
    userId: params.userId,
    tierName: params.tierName,
    billingCycle: params.billingCycle,
    verifiedAmountTzs: params.verifiedAmountTzs,
    verifiedAmountUsd: params.verifiedAmountUsd,
    chargedCurrency: params.chargedCurrency,
  });

  const settlementStatus: SettlementStatus =
    params.verifiedAmountTzs === 0
      ? 'settled'
      : params.gateway === 'AZAMPAY_MPESA_TZS'
        ? 'settled'
        : 'pending_payout';

  return {
    settlementId: `stl-${Date.now().toString(36)}`,
    batchId: splitMeta.internalBatchRef,
    transactionReference: params.transactionReference,
    userId: params.userId,
    tierName: params.tierName,
    billingCycle: params.billingCycle,
    gateway: params.gateway,
    paymentChannel: params.paymentChannel,
    grossAmountTzs: params.verifiedAmountTzs,
    grossAmountUsd: params.verifiedAmountUsd,
    chargedCurrency: params.chargedCurrency,
    chargedAmount: params.chargedAmount,
    settlementStatus,
    settledAt: nowIso,
    createdAt: nowIso,
  };
}

export function recordMerchantSettlementLedger(
  entry: SettlementLedgerEntry
): void {
  if (typeof window === 'undefined') return;
  try {
    // Purge legacy v1 storage if present to guarantee zero residual banking strings
    window.localStorage.removeItem('mineconnect.db.merchant_settlement_ledger.v1');
    const raw = window.localStorage.getItem(SETTLEMENT_LEDGER_STORAGE_KEY);
    const list: SettlementLedgerEntry[] = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    window.localStorage.setItem(
      SETTLEMENT_LEDGER_STORAGE_KEY,
      JSON.stringify(list.slice(0, 300))
    );
  } catch {
    // ignore storage quota errors
  }
}

export function getMerchantSettlementLedger(): SettlementLedgerEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SETTLEMENT_LEDGER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SettlementLedgerEntry[]) : [];
  } catch {
    return [];
  }
}
