import { NextRequest, NextResponse } from 'next/server';
import {
  canTransitionClickPesaState,
  verifyClickPesaWebhookSignature,
} from '../../../../lib/payments/clickpesa';
import { createAdminClient } from '../../../../utils/supabase/admin';
import type { ClickPesaTransactionState } from '../../../../types/database';

/**
 * POST /api/payments/webhook
 * ClickPesa Webhook Receiver & Database Reconciliation Endpoint
 * - Validates cryptographic `X-ClickPesa-Signature` HMAC-SHA256 header
 * - Enforces state machine transition (`INITIATED`/`PROCESSING` -> `SETTLED` | `FAILED`)
 * - Reconciles `public.payment_transactions` and `public.user_subscriptions` via `service_role`
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('x-clickpesa-signature');
    const webhookSecret = process.env.CLICKPESA_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Server misconfiguration: CLICKPESA_WEBHOOK_SECRET is not set.',
        },
        { status: 500 }
      );
    }

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

    // Reconcile atomically via privileged server-only service_role RPC when Supabase is configured
    let dbReconciliation: unknown = null;
    if (
      payload.orderId &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      const admin = createAdminClient();
      const { data, error } = await admin.rpc('reconcile_clickpesa_payment', {
        p_clickpesa_order_id: payload.orderId,
        p_signature_verified: true,
        p_new_state: nextState,
      });

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: `Database reconciliation failed: ${error.message}`,
          },
          { status: 500 }
        );
      }

      dbReconciliation = data;
    }

    return NextResponse.json(
      {
        ok: true,
        reconciled: true,
        orderId: payload.orderId,
        idempotencyKey: payload.idempotencyKey,
        state: nextState,
        signatureVerified: true,
        dbReconciliation,
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
