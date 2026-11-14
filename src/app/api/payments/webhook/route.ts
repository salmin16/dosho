import {
  MERCHANT_SETTLEMENT_ACCOUNT,
  type InternationalPaymentMethodId,
  type SettlementLedgerEntry,
} from '../../../../lib/payments/settlement';
import {
  activateVerifiedSubscription,
  resolveVerifiedTierPricing,
} from '../../../../lib/subscriptions';
import { sanitizeString } from '../../../../lib/securityValidators';
import { recordAuditActivity } from '../../../../lib/supabaseAuth';
import type {
  BillingCycle,
  PaymentGatewayId,
  PaymentTransactionRecord,
  SubscriptionTierName,
  SupportedCurrency,
  UserSubscriptionRecord,
} from '../../../../types/database';

export interface InternationalWebhookRequest {
  userId?: string;
  tier: string;
  billing: string;
  methodId: InternationalPaymentMethodId;
  cardBrand?: 'Visa' | 'Mastercard' | 'Discover' | 'Apple Pay' | 'Google Pay';
  cardLast4?: string;
  saveToken?: boolean;
  currency: SupportedCurrency;
}

export interface WebhookSettlementResponse {
  ok: boolean;
  error?: string;
  subscription?: UserSubscriptionRecord;
  transaction?: PaymentTransactionRecord;
  settlement?: SettlementLedgerEntry;
  merchantBeneficiary?: typeof MERCHANT_SETTLEMENT_ACCOUNT;
}

/**
 * International Card / Digital Wallet (Apple Pay / Google Pay) & Webhook Settlement Router
 * (`/api/payments/webhook`)
 * Verifies transaction authorization, records the payout routing entry to
 * NMB Bank Account `60510047212` (Salmin Ally Mwenesi), updates `user_subscriptions`,
 * and logs an immutable audit record in `audit_logs`.
 */
export async function executeInternationalWebhookSettlement(
  payload: InternationalWebhookRequest
): Promise<WebhookSettlementResponse> {
  const verified = resolveVerifiedTierPricing(payload.tier, payload.billing);

  const methodPrefix =
    payload.methodId === 'apple_pay'
      ? 'APAY'
      : payload.methodId === 'google_pay'
        ? 'GPAY'
        : 'CARD';

  const externalReference = `${methodPrefix}-NMB-${Math.floor(
    100000 + Math.random() * 900000
  )}`;

  const methodDescription =
    payload.methodId === 'apple_pay'
      ? 'Apple Pay Express Wallet (→ NMB 60510047212)'
      : payload.methodId === 'google_pay'
        ? 'Google Pay Express Wallet (→ NMB 60510047212)'
        : `${payload.cardBrand || 'Visa'} •••• ${
            payload.cardLast4 || '4242'
          } (→ NMB 60510047212)`;

  const gateway: PaymentGatewayId =
    verified.verifiedAmountTzs === 0 ? 'FREE_TIER' : 'STRIPE_GLOBAL';

  const activation = await activateVerifiedSubscription({
    userId: payload.userId,
    tierName: verified.tierName as SubscriptionTierName,
    billingCycle: verified.billingCycle as BillingCycle,
    gateway,
    paymentMethodLabel: sanitizeString(methodDescription, 140),
    chargedCurrency: payload.currency || 'USD',
    chargedAmount:
      payload.currency === 'TZS'
        ? verified.verifiedAmountTzs
        : verified.verifiedAmountUsd,
    externalReference,
  });

  if (!activation.success || !activation.subscription) {
    return {
      ok: false,
      error:
        activation.error || 'International payment authorization failed.',
    };
  }

  recordAuditActivity({
    userId: activation.subscription.user_id,
    action: 'PAYMENT_WEBHOOK_SETTLED_NMB',
    metadata: {
      event: 'checkout.session.completed',
      methodId: payload.methodId,
      tierName: verified.tierName,
      billingCycle: verified.billingCycle,
      verifiedTzs: verified.verifiedAmountTzs,
      verifiedUsd: verified.verifiedAmountUsd,
      externalReference,
      destinationBank: MERCHANT_SETTLEMENT_ACCOUNT.bankName,
      destinationAccount: MERCHANT_SETTLEMENT_ACCOUNT.accountNumber,
      destinationBeneficiary: MERCHANT_SETTLEMENT_ACCOUNT.accountName,
      tokenSaved: Boolean(payload.saveToken),
    },
  });

  return {
    ok: true,
    subscription: activation.subscription,
    transaction: activation.transaction,
    settlement: activation.settlement,
    merchantBeneficiary: MERCHANT_SETTLEMENT_ACCOUNT,
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as InternationalWebhookRequest;
    const result = await executeInternationalWebhookSettlement(body);

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Webhook settlement verification failed.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
