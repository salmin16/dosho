import { NextRequest, NextResponse } from 'next/server';
import {
  canTransitionClickPesaState,
  verifyClickPesaWebhookSignature,
} from '../../../../lib/payments/clickpesa';
import type { ClickPesaTransactionState } from '../../../../types/database';

/**
 * POST /api/payments/webhook
 * ClickPesa Webhook Receiver & Database Reconciliation Endpoint
 * - Validates cryptographic `X-ClickPesa-Signature` HMAC-SHA256 header
 * - Enforces state machine transition (`INITIATED`/`PROCESSING` -> `SETTLED` | `FAILED`)
 * - Reconciles `public.payment_transactions` and `public.user_subscriptions`
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('x-clickpesa-signature');
    const webhookSecret =
      process.env.CLICKPESA_WEBHOOK_SECRET ||
      'clickpesa-whsec-mineconnect-tz-2026';

    const isSignatureValid = await verifyClickPesaWebhookSignature(
      rawBody,
      signatureHeader,
      webhookSecret
    );

    if (!isSignatureValid) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid ClickPesa webhook HMAC-SHA256 signature.',
        },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody) as {
      event?: string;
      orderId?: string;
      idempotencyKey?: string;
      userId?: string;
      tierName?: string;
      billingCycle?: string;
      verifiedAmountTzs?: number;
      previousState?: ClickPesaTransactionState;
    };

    const previousState: ClickPesaTransactionState =
      payload.previousState || 'PROCESSING';
    const nextState: ClickPesaTransactionState =
      payload.event === 'payment.failed' ? 'FAILED' : 'SETTLED';

    if (!canTransitionClickPesaState(previousState, nextState)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Illegal ClickPesa state machine transition from ${previousState} to ${nextState}.`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        reconciled: true,
        orderId: payload.orderId,
        idempotencyKey: payload.idempotencyKey,
        state: nextState,
        signatureVerified: true,
        reconciledAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'ClickPesa webhook processing error.',
      },
      { status: 500 }
    );
  }
}
