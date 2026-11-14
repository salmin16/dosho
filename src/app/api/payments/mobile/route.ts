import {
  MERCHANT_SETTLEMENT_ACCOUNT,
  type MobileMoneyOperatorId,
  type SettlementLedgerEntry,
} from '../../../../lib/payments/settlement';
import {
  activateVerifiedSubscription,
  resolveVerifiedTierPricing,
} from '../../../../lib/subscriptions';
import { sanitizeString } from '../../../../lib/securityValidators';
import type {
  BillingCycle,
  PaymentTransactionRecord,
  SubscriptionTierName,
  SupportedCurrency,
  UserSubscriptionRecord,
} from '../../../../types/database';

export interface MobileMoneyChargeRequest {
  userId?: string;
  tier: string;
  billing: string;
  operatorId: MobileMoneyOperatorId;
  operatorLabel: string;
  mobileNumber: string;
  pinOrPassword: string;
  currency: SupportedCurrency;
}

export interface MobileMoneyChargeResponse {
  ok: boolean;
  error?: string;
  subscription?: UserSubscriptionRecord;
  transaction?: PaymentTransactionRecord;
  settlement?: SettlementLedgerEntry;
  merchantBeneficiary?: typeof MERCHANT_SETTLEMENT_ACCOUNT;
}

const OPERATOR_REF_PREFIX: Record<MobileMoneyOperatorId, string> = {
  airtel_money: 'AIRTEL',
  mixx_by_yas: 'MIXX',
  halopesa: 'HALO',
  azampesa: 'AZAM',
  mpesa: 'MPESA',
  tpesa: 'TPESA',
  card_redirect: 'CARD',
};

/**
 * Local Mobile Money Gateway Charge & NMB Bank Settlement Handler (`/api/payments/mobile`)
 * Authorizes East African Mobile Money transactions (Airtel Money, Mixx by Yas,
 * Halopesa, Azampesa, M-Pesa, T-Pesa), routes settlement directly to NMB Bank
 * Account `60510047212` (Salmin Ally Mwenesi), and activates `user_subscriptions`.
 */
export async function executeMobileMoneyCharge(
  payload: MobileMoneyChargeRequest
): Promise<MobileMoneyChargeResponse> {
  const verified = resolveVerifiedTierPricing(payload.tier, payload.billing);

  const digits = (payload.mobileNumber || '').replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) {
    return {
      ok: false,
      error:
        'Please enter a valid mobile money phone number (e.g., 0754 XXX XXX or +255 7XX XXX XXX).',
    };
  }

  const cleanPin = (payload.pinOrPassword || '').trim();
  if (cleanPin.length < 4 || cleanPin.length > 12) {
    return {
      ok: false,
      error:
        'Please enter your 4-to-6 digit Mobile Money PIN or account authorization password.',
    };
  }

  const prefix = OPERATOR_REF_PREFIX[payload.operatorId] || 'MMONEY';
  const externalReference = `${prefix}-NMB-${Math.floor(
    100000 + Math.random() * 900000
  )}`;

  const maskedPhone =
    digits.length >= 6
      ? `+${digits.slice(0, 3)}•••${digits.slice(-3)}`
      : payload.mobileNumber;

  const paymentMethodLabel = sanitizeString(
    `${payload.operatorLabel} (${maskedPhone} → NMB 60510047212)`,
    140
  );

  const activation = await activateVerifiedSubscription({
    userId: payload.userId,
    tierName: verified.tierName as SubscriptionTierName,
    billingCycle: verified.billingCycle as BillingCycle,
    gateway: 'AZAMPAY_MPESA_TZS',
    paymentMethodLabel,
    chargedCurrency: payload.currency || 'TZS',
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
        activation.error || 'Mobile money transaction authorization failed.',
    };
  }

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
    const body = (await request.json()) as MobileMoneyChargeRequest;
    const result = await executeMobileMoneyCharge(body);

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
            : 'Invalid mobile money payment request.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
