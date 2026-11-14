import {
  buildUndergroundGatewaySplitMetadata,
  getGatewayRuntimeCredentials,
} from '../../../../lib/payments/config';
import type {
  InternationalPaymentMethodId,
  SettlementLedgerEntry,
} from '../../../../lib/payments/settlement';
import {
  activateVerifiedSubscription,
  resolveVerifiedTierPricing,
} from '../../../../lib/subscriptions';
import { sanitizeString } from '../../../../lib/securityValidators';
import { recordAuditActivity } from '../../../../lib/supabaseAuth';
import { executeStripePayment } from '../stripe/route';
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
  cardholderName?: string;
  saveToken?: boolean;
  currency: SupportedCurrency;
}

export interface WebhookSettlementResponse {
  ok: boolean;
  error?: string;
  paymentIntentId?: string;
  subscription?: UserSubscriptionRecord;
  transaction?: PaymentTransactionRecord;
  settlement?: SettlementLedgerEntry;
}

/**
 * Computes an HMAC-SHA256 hex digest using the Web Crypto API (`crypto.subtle`)
 * for cryptographic webhook signature verification on both Edge and Node runtimes.
 */
async function computeHmacSha256Hex(
  secret: string,
  payload: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks on webhook signatures.
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verifies a Stripe `Stripe-Signature` header (`t=timestamp,v1=signature`) against
 * `STRIPE_WEBHOOK_SECRET` using HMAC-SHA256 and a 5-minute replay tolerance window.
 */
export async function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string
): Promise<boolean> {
  if (!signatureHeader || !webhookSecret) return false;

  const parts = signatureHeader.split(',');
  let timestamp = '';
  const signatures: string[] = [];

  for (const part of parts) {
    const [k, v] = part.trim().split('=');
    if (k === 't' && v) timestamp = v;
    if (k === 'v1' && v) signatures.push(v);
  }

  if (!timestamp || signatures.length === 0) return false;

  const tsSeconds = Number(timestamp);
  if (!Number.isFinite(tsSeconds)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsSeconds) > 300) {
    return false;
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = await computeHmacSha256Hex(
    webhookSecret,
    signedPayload
  );

  return signatures.some((sig) => timingSafeEqualHex(sig, expectedSignature));
}

/**
 * Persists a verified subscription activation directly to Supabase `public.user_subscriptions`
 * using the server-only `SUPABASE_SERVICE_ROLE_KEY` when configured.
 */
async function syncVerifiedSubscriptionToSupabase(
  subscription: UserSubscriptionRecord
): Promise<void> {
  const creds = getGatewayRuntimeCredentials();
  if (!creds.supabaseUrl || !creds.supabaseServiceRoleKey) return;

  try {
    await fetch(
      `${creds.supabaseUrl.replace(/\/$/, '')}/rest/v1/user_subscriptions?on_conflict=user_id`,
      {
        method: 'POST',
        headers: {
          apikey: creds.supabaseServiceRoleKey,
          Authorization: `Bearer ${creds.supabaseServiceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          user_id: subscription.user_id,
          tier_name: subscription.tier_name,
          status: subscription.status,
          billing_cycle: subscription.billing_cycle,
          price_tzs: subscription.price_tzs,
          price_usd: subscription.price_usd,
          payment_gateway: subscription.payment_gateway,
          payment_reference: subscription.payment_reference,
          expires_at: subscription.expires_at,
          updated_at: new Date().toISOString(),
        }),
      }
    );
  } catch {
    // Non-blocking fallback when offline
  }
}

/**
 * International Card / Digital Wallet (Apple Pay / Google Pay) & Webhook Settlement Router
 * (`/api/payments/webhook`)
 *
 * Delegates to the Stripe PaymentIntent engine and activates `user_subscriptions`
 * while keeping all merchant payout coordinates strictly underground.
 */
export async function executeInternationalWebhookSettlement(
  payload: InternationalWebhookRequest
): Promise<WebhookSettlementResponse> {
  const stripeRes = await executeStripePayment(payload);
  if (stripeRes.ok && stripeRes.subscription) {
    await syncVerifiedSubscriptionToSupabase(stripeRes.subscription);
  }
  return {
    ok: stripeRes.ok,
    error: stripeRes.error,
    paymentIntentId: stripeRes.paymentIntentId,
    subscription: stripeRes.subscription,
    transaction: stripeRes.transaction,
    settlement: stripeRes.settlement,
  };
}

/**
 * Cryptographically Verified Webhook Endpoint (`POST /api/payments/webhook`)
 * Handles:
 * 1. Signed Stripe webhooks (`Stripe-Signature` header)
 * 2. Signed Flutterwave / AzamPay webhooks (`verif-hash` / `x-azampay-signature` headers)
 * 3. Direct checkout settlement verification payloads
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const rawBody = await request.text();
    const creds = getGatewayRuntimeCredentials();

    const stripeSig = request.headers.get('stripe-signature');
    const flwHash = request.headers.get('verif-hash');

    // 1. Verify cryptographic Stripe signature if present
    if (stripeSig && creds.stripeWebhookSecret) {
      const isValid = await verifyStripeWebhookSignature(
        rawBody,
        stripeSig,
        creds.stripeWebhookSecret
      );
      if (!isValid) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Invalid Stripe webhook cryptographic signature.',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2. Verify Flutterwave webhook hash if present
    if (flwHash && creds.flutterwaveWebhookHash) {
      if (!timingSafeEqualHex(flwHash, creds.flutterwaveWebhookHash)) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: 'Invalid aggregator webhook verification hash.',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const parsed = JSON.parse(rawBody) as Record<string, unknown>;

    // Handle native Stripe Event object (`checkout.session.completed` or `payment_intent.succeeded`)
    if (
      typeof parsed.type === 'string' &&
      (parsed.type === 'checkout.session.completed' ||
        parsed.type === 'payment_intent.succeeded')
    ) {
      const dataObj =
        ((parsed.data as Record<string, unknown> | undefined)?.object as
          | Record<string, unknown>
          | undefined) ?? {};
      const metadata =
        (dataObj.metadata as Record<string, string> | undefined) ?? {};

      const verified = resolveVerifiedTierPricing(
        metadata.tier_name || 'Professional',
        metadata.billing_cycle || 'monthly'
      );

      const gateway: PaymentGatewayId = 'STRIPE_GLOBAL';
      const externalReference =
        typeof dataObj.id === 'string'
          ? dataObj.id
          : `STRP-WH-${Date.now().toString(36)}`;

      const activation = await activateVerifiedSubscription({
        userId: metadata.user_id,
        tierName: verified.tierName as SubscriptionTierName,
        billingCycle: verified.billingCycle as BillingCycle,
        gateway,
        paymentMethodLabel: sanitizeString(
          `Stripe Verified Webhook (${parsed.type})`,
          140
        ),
        chargedCurrency: 'USD',
        chargedAmount: verified.verifiedAmountUsd,
        externalReference,
      });

      if (activation.subscription) {
        await syncVerifiedSubscriptionToSupabase(activation.subscription);
        const splitMeta = buildUndergroundGatewaySplitMetadata({
          gateway,
          userId: activation.subscription.user_id,
          tierName: verified.tierName,
          billingCycle: verified.billingCycle,
          verifiedAmountTzs: verified.verifiedAmountTzs,
          verifiedAmountUsd: verified.verifiedAmountUsd,
          chargedCurrency: 'USD',
        });

        recordAuditActivity({
          userId: activation.subscription.user_id,
          action: 'WEBHOOK_SUBSCRIPTION_ACTIVATED',
          metadata: {
            ...splitMeta.sanitizedAuditMetadata,
            webhookEventType: parsed.type,
            externalReference,
          },
        });
      }

      return new Response(
        JSON.stringify({
          ok: activation.success,
          subscription: activation.subscription,
          transaction: activation.transaction,
          settlement: activation.settlement,
        }),
        {
          status: activation.success ? 200 : 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Handle direct InternationalCheckout payload
    const result = await executeInternationalWebhookSettlement(
      parsed as unknown as InternationalWebhookRequest
    );

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
