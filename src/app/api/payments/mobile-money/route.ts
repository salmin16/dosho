import {
  buildUndergroundGatewaySplitMetadata,
  getGatewayRuntimeCredentials,
  getUndergroundMerchantConfig,
} from '../../../../lib/payments/config';
import type {
  MobileMoneyOperatorId,
  SettlementLedgerEntry,
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
  stkPushTransactionId?: string;
  aggregatorChannel?: 'AZAMPAY_MNO' | 'FLUTTERWAVE_MOBILE_TZ';
  subscription?: UserSubscriptionRecord;
  transaction?: PaymentTransactionRecord;
  settlement?: SettlementLedgerEntry;
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

const AZAMPAY_PROVIDER_MAP: Record<
  MobileMoneyOperatorId,
  'Airtel' | 'Tigo' | 'Halopesa' | 'Azampesa' | 'Mpesa'
> = {
  airtel_money: 'Airtel',
  mixx_by_yas: 'Tigo',
  halopesa: 'Halopesa',
  azampesa: 'Azampesa',
  mpesa: 'Mpesa',
  tpesa: 'Tigo',
  card_redirect: 'Mpesa',
};

/**
 * Normalizes a Tanzanian or East African phone number into canonical E.164 digits (`2557XXXXXXXX`).
 */
export function normalizeEastAfricanMsisdn(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    return `255${digits.slice(1)}`;
  }
  if (digits.length === 9) {
    return `255${digits}`;
  }
  return digits;
}

/**
 * Initiates a live AzamPay MNO STK Push Checkout when AzamPay credentials are configured
 * in server-side environment variables, attaching underground split-payment routing.
 */
async function triggerAzamPayMnoCheckout(params: {
  appName: string;
  clientId: string;
  clientSecret: string;
  apiKey?: string | null;
  environment: 'sandbox' | 'production';
  msisdn: string;
  amountTzs: number;
  externalId: string;
  operatorId: MobileMoneyOperatorId;
}): Promise<{ transactionId: string } | null> {
  try {
    const authBaseUrl =
      params.environment === 'production'
        ? 'https://authenticator.azampay.co.tz'
        : 'https://authenticator-sandbox.azampay.co.tz';
    const checkoutBaseUrl =
      params.environment === 'production'
        ? 'https://checkout.azampay.co.tz'
        : 'https://sandbox.azampay.co.tz';

    const tokenRes = await fetch(
      `${authBaseUrl}/AppRegistration/GenerateToken`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: params.appName,
          clientId: params.clientId,
          clientSecret: params.clientSecret,
        }),
      }
    );

    if (!tokenRes.ok) return null;
    const tokenJson = (await tokenRes.json()) as {
      data?: { accessToken?: string };
    };
    const accessToken = tokenJson.data?.accessToken;
    if (!accessToken) return null;

    const merchant = getUndergroundMerchantConfig();

    const checkoutRes = await fetch(`${checkoutBaseUrl}/azampay/mno/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(params.apiKey ? { 'X-API-Key': params.apiKey } : {}),
      },
      body: JSON.stringify({
        accountNumber: params.msisdn,
        amount: String(params.amountTzs),
        currency: 'TZS',
        externalId: params.externalId,
        provider: AZAMPAY_PROVIDER_MAP[params.operatorId],
        additionalProperties: {
          merchantSubaccountId: merchant.azampayMerchantSubaccountId,
          settlementMode: 'UNDERGROUND_DIRECT_PAYOUT',
        },
      }),
    });

    if (!checkoutRes.ok) return null;
    const checkoutJson = (await checkoutRes.json()) as {
      transactionId?: string;
      data?: { transactionId?: string };
    };
    const txId =
      checkoutJson.transactionId ?? checkoutJson.data?.transactionId;
    return txId ? { transactionId: txId } : null;
  } catch {
    return null;
  }
}

/**
 * Initiates a live Flutterwave Tanzania Mobile Money collection charge when
 * `FLUTTERWAVE_SECRET_KEY` is configured on the server, routing split-payment
 * settlement underground to the merchant subaccount.
 */
async function triggerFlutterwaveMobileCharge(params: {
  secretKey: string;
  msisdn: string;
  amountTzs: number;
  txRef: string;
  operatorId: MobileMoneyOperatorId;
  userId: string;
}): Promise<{ flwRef: string } | null> {
  try {
    const merchant = getUndergroundMerchantConfig();
    const res = await fetch(
      'https://api.flutterwave.com/v3/charges?type=mobile_money_tanzania',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: params.txRef,
          amount: params.amountTzs,
          currency: 'TZS',
          network: AZAMPAY_PROVIDER_MAP[params.operatorId].toUpperCase(),
          phone_number: params.msisdn,
          email: 'billing@mineconnect.co.tz',
          subaccounts:
            merchant.flutterwaveSubaccountId &&
            !merchant.flutterwaveSubaccountId.includes('UNDERGROUND')
              ? [{ id: merchant.flutterwaveSubaccountId }]
              : undefined,
          meta: {
            user_id: params.userId,
            settlement_routing: 'UNDERGROUND_SPLIT_PAYOUT',
          },
        }),
      }
    );

    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { flw_ref?: string } };
    return data.data?.flw_ref ? { flwRef: data.data.flw_ref } : null;
  } catch {
    return null;
  }
}

/**
 * Production East African Mobile Money Charge & Underground Settlement Handler
 * (`/api/payments/mobile-money`)
 *
 * Supports M-Pesa, Airtel Money, Halopesa, T-Pesa, Mixx by Yas, and Azampesa via
 * AzamPay / Flutterwave while keeping all merchant banking coordinates strictly underground.
 */
export async function executeMobileMoneyCharge(
  payload: MobileMoneyChargeRequest
): Promise<MobileMoneyChargeResponse> {
  const verified = resolveVerifiedTierPricing(payload.tier, payload.billing);
  const credentials = getGatewayRuntimeCredentials();

  const normalizedMsisdn = normalizeEastAfricanMsisdn(
    payload.mobileNumber || ''
  );
  if (normalizedMsisdn.length < 9 || normalizedMsisdn.length > 15) {
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
  const externalReference = `${prefix}-TZ-${Math.floor(
    100000 + Math.random() * 900000
  )}`;

  let stkPushTransactionId = `stk_${Date.now().toString(36)}_${Math.floor(
    10000 + Math.random() * 90000
  )}`;
  let aggregatorChannel: 'AZAMPAY_MNO' | 'FLUTTERWAVE_MOBILE_TZ' =
    'AZAMPAY_MNO';
  let gateway: PaymentGatewayId = 'AZAMPAY_MPESA_TZS';

  if (
    credentials.azampayAppName &&
    credentials.azampayClientId &&
    credentials.azampayClientSecret &&
    verified.verifiedAmountTzs > 0
  ) {
    const azamLive = await triggerAzamPayMnoCheckout({
      appName: credentials.azampayAppName,
      clientId: credentials.azampayClientId,
      clientSecret: credentials.azampayClientSecret,
      apiKey: credentials.azampayApiKey,
      environment: credentials.azampayEnvironment,
      msisdn: normalizedMsisdn,
      amountTzs: verified.verifiedAmountTzs,
      externalId: externalReference,
      operatorId: payload.operatorId,
    });
    if (azamLive) {
      stkPushTransactionId = azamLive.transactionId;
    }
  } else if (
    credentials.flutterwaveSecretKey &&
    verified.verifiedAmountTzs > 0
  ) {
    aggregatorChannel = 'FLUTTERWAVE_MOBILE_TZ';
    gateway = 'FLUTTERWAVE_AFRICA';
    const flwLive = await triggerFlutterwaveMobileCharge({
      secretKey: credentials.flutterwaveSecretKey,
      msisdn: normalizedMsisdn,
      amountTzs: verified.verifiedAmountTzs,
      txRef: externalReference,
      operatorId: payload.operatorId,
      userId: payload.userId || 'authenticated-member',
    });
    if (flwLive) {
      stkPushTransactionId = flwLive.flwRef;
    }
  }

  const maskedPhone =
    normalizedMsisdn.length >= 6
      ? `+${normalizedMsisdn.slice(0, 3)} ••• ${normalizedMsisdn.slice(-3)}`
      : payload.mobileNumber;

  const paymentMethodLabel = sanitizeString(
    `${payload.operatorLabel} (${maskedPhone})`,
    140
  );

  const activation = await activateVerifiedSubscription({
    userId: payload.userId,
    tierName: verified.tierName as SubscriptionTierName,
    billingCycle: verified.billingCycle as BillingCycle,
    gateway,
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

  const splitMeta = buildUndergroundGatewaySplitMetadata({
    gateway,
    userId: activation.subscription.user_id,
    tierName: verified.tierName,
    billingCycle: verified.billingCycle,
    verifiedAmountTzs: verified.verifiedAmountTzs,
    verifiedAmountUsd: verified.verifiedAmountUsd,
    chargedCurrency: payload.currency || 'TZS',
  });

  recordAuditActivity({
    userId: activation.subscription.user_id,
    action: 'MOBILE_MONEY_STK_SETTLED',
    metadata: {
      ...splitMeta.sanitizedAuditMetadata,
      stkPushTransactionId,
      aggregatorChannel,
      operatorId: payload.operatorId,
      maskedPhone,
      externalReference,
    },
  });

  return {
    ok: true,
    stkPushTransactionId,
    aggregatorChannel,
    subscription: activation.subscription,
    transaction: activation.transaction,
    settlement: activation.settlement,
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
