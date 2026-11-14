import {
  activateVerifiedSubscription,
  resolveVerifiedTierPricing,
} from '../../../lib/subscriptions';
import { sanitizeString } from '../../../lib/securityValidators';
import type {
  BillingCycle,
  PaymentGatewayId,
  SubscriptionTierName,
  SupportedCurrency,
} from '../../../types/database';

export interface CreateCheckoutSessionRequest {
  userId?: string;
  tier: string;
  billing: string;
  gateway: PaymentGatewayId;
  paymentMethodLabel: string;
  currency: SupportedCurrency;
  mobilePhone?: string;
  cardLast4?: string;
}

/**
 * Server-Side Checkout Session Generator & Anti-Tampering Price Validator (`/api/checkout`)
 * Looks up the exact canonical tier price on the server (ignoring any client-supplied price),
 * creates the gateway session (Stripe Global or AzamPay/Flutterwave Mobile Money), and triggers
 * verified webhook settlement.
 */
export async function processVerifiedCheckoutSession(
  payload: CreateCheckoutSessionRequest
) {
  const verified = resolveVerifiedTierPricing(payload.tier, payload.billing);

  const gateway: PaymentGatewayId =
    verified.verifiedAmountTzs === 0 ? 'FREE_TIER' : payload.gateway;

  const cleanMethodLabel = sanitizeString(
    payload.paymentMethodLabel ||
      (gateway === 'STRIPE_GLOBAL'
        ? 'Stripe International Card'
        : gateway === 'AZAMPAY_MPESA_TZS'
          ? 'M-Pesa / Tigo Pesa (AzamPay TZS)'
          : gateway === 'FLUTTERWAVE_AFRICA'
            ? 'Flutterwave Pan-African Rail'
            : 'Explorer Free Activation'),
    120
  );

  // Validate mobile money phone format when regional mobile money is selected
  if (
    verified.verifiedAmountTzs > 0 &&
    gateway === 'AZAMPAY_MPESA_TZS' &&
    payload.mobilePhone
  ) {
    const digits = payload.mobilePhone.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) {
      return {
        ok: false,
        error:
          'Please enter a valid Tanzania Mobile Money number (e.g., +255 7XX XXX XXX).',
      };
    }
  }

  const activation = await activateVerifiedSubscription({
    userId: payload.userId,
    tierName: verified.tierName as SubscriptionTierName,
    billingCycle: verified.billingCycle as BillingCycle,
    gateway,
    paymentMethodLabel: cleanMethodLabel,
    chargedCurrency: payload.currency,
    chargedAmount:
      payload.currency === 'TZS'
        ? verified.verifiedAmountTzs
        : verified.verifiedAmountUsd,
  });

  if (!activation.success || !activation.subscription) {
    return {
      ok: false,
      error: activation.error ?? 'Failed to initialize checkout session.',
    };
  }

  return {
    ok: true,
    verifiedPricing: {
      tierName: verified.tierName,
      billingCycle: verified.billingCycle,
      amountTzs: verified.verifiedAmountTzs,
      amountUsd: verified.verifiedAmountUsd,
    },
    subscription: activation.subscription,
    transaction: activation.transaction,
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as CreateCheckoutSessionRequest;
    const result = await processVerifiedCheckoutSession(body);

    if (!result.ok) {
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          err instanceof Error ? err.message : 'Invalid checkout payload.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
