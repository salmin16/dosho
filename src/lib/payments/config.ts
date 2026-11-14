/**
 * Underground Merchant Settlement & Payment Gateway Configuration (`src/lib/payments/config.ts`)
 *
 * SECURITY ARCHITECTURE:
 * - All merchant banking coordinates (Bank Name, Account Number, Beneficiary Name, SWIFT/BIC)
 *   are read exclusively from server-side environment variables (`process.env.MERCHANT_*`).
 * - They are NEVER prefixed with `NEXT_PUBLIC_` or `VITE_` and are NEVER serialized into
 *   client-facing responses, UI components, receipts, or public audit logs.
 * - Payout routing is executed strictly server-to-server between backend route handlers and
 *   Stripe / AzamPay / Flutterwave split-payment subaccounts.
 */

import type {
  BillingCycle,
  PaymentGatewayId,
  SubscriptionTierName,
  SupportedCurrency,
} from '../../types/database';

export interface UndergroundMerchantPayoutConfig {
  readonly bankName: string;
  readonly bankCode: string;
  readonly swiftBic: string;
  readonly accountNumber: string;
  readonly accountName: string;
  readonly settlementCurrency: 'TZS';
  readonly stripeConnectedAccountId: string;
  readonly azampayMerchantSubaccountId: string;
  readonly flutterwaveSubaccountId: string;
  readonly dpoServiceTypeId: string;
}

export interface GatewayRuntimeCredentials {
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
  azampayAppName: string | null;
  azampayClientId: string | null;
  azampayClientSecret: string | null;
  azampayApiKey: string | null;
  azampayEnvironment: 'sandbox' | 'production';
  flutterwaveSecretKey: string | null;
  flutterwaveWebhookHash: string | null;
  supabaseUrl: string | null;
  supabaseServiceRoleKey: string | null;
}

function readServerEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    const val = process.env[key];
    if (val && val.trim().length > 0) {
      return val.trim();
    }
  }
  return undefined;
}

/**
 * Retrieves the underground merchant settlement profile strictly on the server.
 * Never return the return value of this function to any client response or browser payload.
 */
export function getUndergroundMerchantConfig(): UndergroundMerchantPayoutConfig {
  const bankName = readServerEnv('MERCHANT_BANK_NAME') ?? 'NMB';
  const accountNumber = readServerEnv('MERCHANT_ACCOUNT_NUMBER') ?? '';
  const accountName = readServerEnv('MERCHANT_ACCOUNT_NAME') ?? '';
  const swiftBic = readServerEnv('MERCHANT_BANK_SWIFT') ?? 'NMIBTZTZ';

  return Object.freeze({
    bankName,
    bankCode: 'NMB-TZ',
    swiftBic,
    accountNumber,
    accountName,
    settlementCurrency: 'TZS',
    stripeConnectedAccountId:
      readServerEnv('STRIPE_CONNECTED_ACCOUNT_ID') ??
      'acct_underground_merchant_tz',
    azampayMerchantSubaccountId:
      readServerEnv('AZAMPAY_MERCHANT_SUBACCOUNT_ID') ??
      'azampay_sub_underground_tz',
    flutterwaveSubaccountId:
      readServerEnv('FLUTTERWAVE_SUBACCOUNT_ID') ?? 'RS_UNDERGROUND_MERCHANT_TZ',
    dpoServiceTypeId:
      readServerEnv('DPO_SERVICE_TYPE_ID') ?? 'DPO_UNDERGROUND_MERCHANT_TZ',
  });
}

/**
 * Reads live gateway API credentials from server-side environment variables.
 */
export function getGatewayRuntimeCredentials(): GatewayRuntimeCredentials {
  return {
    stripeSecretKey: readServerEnv('STRIPE_SECRET_KEY') ?? null,
    stripeWebhookSecret: readServerEnv('STRIPE_WEBHOOK_SECRET') ?? null,
    azampayAppName: readServerEnv('AZAMPAY_APP_NAME') ?? null,
    azampayClientId: readServerEnv('AZAMPAY_CLIENT_ID') ?? null,
    azampayClientSecret: readServerEnv('AZAMPAY_CLIENT_SECRET') ?? null,
    azampayApiKey: readServerEnv('AZAMPAY_API_KEY') ?? null,
    azampayEnvironment:
      readServerEnv('AZAMPAY_ENVIRONMENT') === 'production'
        ? 'production'
        : 'sandbox',
    flutterwaveSecretKey: readServerEnv('FLUTTERWAVE_SECRET_KEY') ?? null,
    flutterwaveWebhookHash: readServerEnv('FLUTTERWAVE_WEBHOOK_HASH') ?? null,
    supabaseUrl:
      readServerEnv('NEXT_PUBLIC_SUPABASE_URL') ??
      readServerEnv('VITE_SUPABASE_URL') ??
      null,
    supabaseServiceRoleKey: readServerEnv('SUPABASE_SERVICE_ROLE_KEY') ?? null,
  };
}

/**
 * Generates an opaque, non-reversible settlement routing descriptor for backend
 * gateway split-payment calls without leaking bank account numbers or beneficiary names.
 */
export function buildUndergroundGatewaySplitMetadata(params: {
  gateway: PaymentGatewayId;
  userId: string;
  tierName: SubscriptionTierName;
  billingCycle: BillingCycle;
  verifiedAmountTzs: number;
  verifiedAmountUsd: number;
  chargedCurrency: SupportedCurrency;
}): {
  internalBatchRef: string;
  gatewaySubaccountToken: string;
  sanitizedAuditMetadata: Record<string, unknown>;
} {
  const merchant = getUndergroundMerchantConfig();
  const dateCompact = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const internalBatchRef = `STL-BATCH-${dateCompact}`;

  const gatewaySubaccountToken =
    params.gateway === 'STRIPE_GLOBAL'
      ? merchant.stripeConnectedAccountId
      : params.gateway === 'AZAMPAY_MPESA_TZS'
        ? merchant.azampayMerchantSubaccountId
        : params.gateway === 'FLUTTERWAVE_AFRICA'
          ? merchant.flutterwaveSubaccountId
          : 'FREE_TIER_NO_SETTLEMENT';

  return {
    internalBatchRef,
    gatewaySubaccountToken,
    sanitizedAuditMetadata: {
      userId: params.userId,
      tierName: params.tierName,
      billingCycle: params.billingCycle,
      gateway: params.gateway,
      verifiedAmountTzs: params.verifiedAmountTzs,
      verifiedAmountUsd: params.verifiedAmountUsd,
      chargedCurrency: params.chargedCurrency,
      settlementBatch: internalBatchRef,
      settlementRoutingMode: 'UNDERGROUND_SERVER_SPLIT',
    },
  };
}
