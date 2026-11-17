import { NextRequest, NextResponse } from 'next/server';
import {
  CLICKPESA_CHANNELS,
  computeClickPesaWebhookSignature,
  generateClickPesaIdempotencyKey,
  generateClickPesaOrderIdentifiers,
  normalizeTanzanianPhone,
} from '../../../../lib/payments/clickpesa';
import {
  normalizeBillingCycle,
  normalizeSubscriptionTier,
  resolveVerifiedTierPricing,
} from '../../../../lib/subscriptions';
import { sanitizeText } from '../../../../lib/securityValidators';
import type { ClickPesaProviderCode } from '../../../../types/database';

// Server-side idempotency memory store for deduplicating rapid concurrent requests
const IDEMPOTENCY_REGISTRY = new Map<
  string,
  {
    orderId: string;
    controlNumber: string;
    tierName: string;
    billingCycle: string;
    providerCode: ClickPesaProviderCode;
    verifiedAmountTzs: number;
    verifiedAmountUsd: number;
    state: 'INITIATED' | 'PROCESSING' | 'SETTLED';
    signature: string;
    createdAt: string;
  }
>();

const VALID_PROVIDER_CODES = new Set<string>([
  'FREE',
  ...Object.keys(CLICKPESA_CHANNELS),
]);

/**
 * POST /api/payments/create
 * Secure ClickPesa Fintech Gateway Payment Creation Endpoint
 * - Server-side tier & billing price lookup (never trusts client amounts)
 * - Idempotency Key deduplication
 * - Supports Mobile Money (M-Pesa, Airtel, Mixx/Tigo, HaloPesa, EzyPesa),
 *   Bank Payments (CRDB, NMB, NBC), and International Cards (Visa, Mastercard, UnionPay)
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const userId = sanitizeText(String(body.userId ?? 'guest-user'), 64);
    const tierName = normalizeSubscriptionTier(String(body.tierName ?? 'Miner'));
    const billingCycle = normalizeBillingCycle(
      String(body.billingCycle ?? 'monthly')
    );

    const rawProvider = String(body.providerCode ?? 'MPESA_TZ').toUpperCase();
    if (!VALID_PROVIDER_CODES.has(rawProvider)) {
      return NextResponse.json(
        {
          error: `Unsupported ClickPesa payment provider: ${rawProvider}`,
        },
        { status: 400 }
      );
    }
    const providerCode = rawProvider as ClickPesaProviderCode;

    // Server-side price lookup (anti-tampering guarantee)
    const verified = resolveVerifiedTierPricing(tierName, billingCycle);

    // Validate phone number if Mobile Money rail is selected
    if (
      providerCode !== 'FREE' &&
      CLICKPESA_CHANNELS[providerCode].rail === 'MOBILE_MONEY' &&
      typeof body.phoneNumber === 'string' &&
      body.phoneNumber.trim().length > 0
    ) {
      const normalizedPhone = normalizeTanzanianPhone(body.phoneNumber);
      if (!normalizedPhone.valid) {
        return NextResponse.json(
          { error: normalizedPhone.error },
          { status: 400 }
        );
      }
    }

    const headerIdemKey = request.headers.get('x-idempotency-key');
    const idempotencyKey = sanitizeText(
      headerIdemKey ||
        (typeof body.idempotencyKey === 'string' && body.idempotencyKey) ||
        generateClickPesaIdempotencyKey({
          userId,
          tierName: verified.tierName,
          billingCycle: verified.billingCycle,
          providerCode,
        }),
      128
    );

    // Idempotency Replay Guard
    const existing = IDEMPOTENCY_REGISTRY.get(idempotencyKey);
    if (existing) {
      return NextResponse.json(
        {
          ok: true,
          idempotentReplay: true,
          gateway: 'CLICKPESA',
          idempotencyKey,
          transaction: existing,
        },
        { status: 200 }
      );
    }

    const { orderId, controlNumber } = generateClickPesaOrderIdentifiers(
      providerCode,
      verified.tierName
    );

    const webhookPayload = JSON.stringify({
      event: 'payment.settled',
      orderId,
      idempotencyKey,
      userId,
      tierName: verified.tierName,
      billingCycle: verified.billingCycle,
      verifiedAmountTzs: verified.verifiedAmountTzs,
    });

    const webhookSecret =
      process.env.CLICKPESA_WEBHOOK_SECRET ||
      'clickpesa-whsec-mineconnect-tz-2026';
    const signature = await computeClickPesaWebhookSignature(
      webhookPayload,
      webhookSecret
    );

    const record = {
      orderId,
      controlNumber,
      tierName: verified.tierName,
      billingCycle: verified.billingCycle,
      providerCode,
      verifiedAmountTzs: verified.verifiedAmountTzs,
      verifiedAmountUsd: verified.verifiedAmountUsd,
      state: 'PROCESSING' as const,
      signature,
      createdAt: new Date().toISOString(),
    };

    IDEMPOTENCY_REGISTRY.set(idempotencyKey, record);

    return NextResponse.json(
      {
        ok: true,
        idempotentReplay: false,
        gateway: 'CLICKPESA',
        idempotencyKey,
        transaction: record,
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Failed to create ClickPesa payment transaction.',
      },
      { status: 500 }
    );
  }
}
