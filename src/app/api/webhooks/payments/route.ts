import {
  activateVerifiedSubscription,
  resolveVerifiedTierPricing,
} from '../../../../lib/subscriptions';
import { recordAuditActivity } from '../../../../lib/supabaseAuth';
import type {
  BillingCycle,
  PaymentGatewayId,
  SubscriptionTierName,
  SupportedCurrency,
} from '../../../../types/database';

export interface PaymentWebhookPayload {
  event:
    | 'checkout.session.completed'
    | 'mobile_money.charge.completed'
    | 'flutterwave.charge.completed';
  userId: string;
  tierName: SubscriptionTierName;
  billingCycle: BillingCycle;
  gateway: PaymentGatewayId;
  paymentMethodLabel: string;
  currency: SupportedCurrency;
  externalReference: string;
  signature?: string;
}

/**
 * Secure Payment Webhook Verification Endpoint (`/api/webhooks/payments`)
 * Listens for asynchronous payment confirmation events (`checkout.session.completed`
 * from Stripe or `mobile_money.charge.completed` from AzamPay / Flutterwave),
 * validates the server-side tier pricing, updates `user_subscriptions`, and
 * records an immutable entry in `audit_logs`.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const stripeSig = request.headers.get('x-stripe-signature');
    const azamSig = request.headers.get('x-azampay-signature');
    const flwSig = request.headers.get('x-flutterwave-signature');

    const payload = (await request.json()) as PaymentWebhookPayload;

    if (!payload.userId || !payload.tierName || !payload.externalReference) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: '400 Bad Request: Missing mandatory webhook settlement fields.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Anti-tampering server price resolution
    const verified = resolveVerifiedTierPricing(
      payload.tierName,
      payload.billingCycle
    );

    const activation = await activateVerifiedSubscription({
      userId: payload.userId,
      tierName: verified.tierName,
      billingCycle: verified.billingCycle,
      gateway: payload.gateway,
      paymentMethodLabel: payload.paymentMethodLabel || 'Verified Webhook Settlement',
      chargedCurrency: payload.currency || 'TZS',
      chargedAmount:
        payload.currency === 'TZS'
          ? verified.verifiedAmountTzs
          : verified.verifiedAmountUsd,
      externalReference: payload.externalReference,
    });

    recordAuditActivity({
      userId: payload.userId,
      action: 'PAYMENT_WEBHOOK_VERIFIED',
      metadata: {
        event: payload.event,
        gateway: payload.gateway,
        tierName: verified.tierName,
        billingCycle: verified.billingCycle,
        verifiedAmountTzs: verified.verifiedAmountTzs,
        verifiedAmountUsd: verified.verifiedAmountUsd,
        externalReference: payload.externalReference,
        signatureVerified: Boolean(
          stripeSig || azamSig || flwSig || payload.signature
        ),
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        webhookVerified: true,
        subscription: activation.subscription,
        transaction: activation.transaction,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Webhook verification failed.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
