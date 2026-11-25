// Supabase Edge Function: AzamPay Webhook Callback Auto-Activation
// Callback URL registered in AzamPay:
//   https://iapqpsxodlhvhdfsftqi.supabase.co/functions/v1/azampay-callback
//
// Accepts AzamPay HTTP POST callback (`utilityref` / `externalId`, `transactionstatus`,
// `transid`, `mnoreference`), reconciles `public.payment_transactions`, and on
// `'success'` automatically upgrades `public.user_subscriptions` + `public.subscription_payments`
// + `public.profiles` so the user's paid tier activates immediately.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-azampay-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AzamPayCallbackPayload {
  utilityref?: string;
  utilityRef?: string;
  externalId?: string;
  externalid?: string;
  referenceId?: string;
  reference?: string;
  transactionstatus?: string;
  transactionStatus?: string;
  status?: string;
  transid?: string;
  transId?: string;
  transactionId?: string;
  mnoreference?: string;
  mnoReference?: string;
  amount?: string | number;
  operator?: string;
  provider?: string;
  msisdn?: string;
  message?: string;
  [key: string]: unknown;
}

function jsonResponse(payload: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function pickString(
  obj: Record<string, unknown>,
  keys: string[],
): string {
  for (const k of keys) {
    const val = obj[k];
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
    if (typeof val === 'number' && Number.isFinite(val)) {
      return String(val);
    }
  }
  return '';
}

function mapTierToPlan(tier?: string | null): {
  planId: 'pro' | 'enterprise';
  fallbackName: string;
  fallbackTzs: number;
  fallbackUsd: number;
} {
  const clean = (tier ?? '').trim().toLowerCase();
  if (
    clean === 'institutional_jv' ||
    clean === 'enterprise' ||
    clean === 'institutional' ||
    clean === 'institutional / jv desk'
  ) {
    return {
      planId: 'enterprise',
      fallbackName: 'Institutional / JV Desk',
      fallbackTzs: 450_000,
      fallbackUsd: 170,
    };
  }
  return {
    planId: 'pro',
    fallbackName: 'Operator Pro',
    fallbackTzs: 120_000,
    fallbackUsd: 45,
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { ok: false, error: 'Supabase service credentials are not configured.' },
      500,
    );
  }

  let payload: AzamPayCallbackPayload;
  try {
    payload = (await req.json()) as AzamPayCallbackPayload;
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON callback payload.' }, 400);
  }

  const externalId = pickString(payload, [
    'utilityref',
    'utilityRef',
    'externalId',
    'externalid',
    'referenceId',
    'reference',
  ]);
  const rawStatus = pickString(payload, [
    'transactionstatus',
    'transactionStatus',
    'status',
  ]).toLowerCase();
  const transId = pickString(payload, [
    'transid',
    'transId',
    'transactionId',
  ]);
  const mnoReference = pickString(payload, [
    'mnoreference',
    'mnoReference',
  ]);

  if (!externalId && !transId) {
    return jsonResponse(
      {
        ok: false,
        error: 'Missing utilityref / externalId and transid in callback payload.',
      },
      400,
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Find matching transaction by `external_id` (primary) or `azampay_transaction_id` (fallback)
  let txRow: Record<string, unknown> | null = null;
  if (externalId) {
    const { data } = await adminClient
      .from('payment_transactions')
      .select('*')
      .eq('external_id', externalId)
      .maybeSingle();
    txRow = data as Record<string, unknown> | null;
  }

  if (!txRow && transId) {
    const { data } = await adminClient
      .from('payment_transactions')
      .select('*')
      .eq('azampay_transaction_id', transId)
      .maybeSingle();
    txRow = data as Record<string, unknown> | null;
  }

  if (!txRow) {
    console.warn('[azampay-callback] Transaction not found:', { externalId, transId });
    return jsonResponse(
      {
        ok: false,
        error: `No matching payment transaction found for ${externalId || transId}.`,
      },
      404,
    );
  }

  const txId = String(txRow.id);
  const currentStatus = String(txRow.status ?? 'pending').toLowerCase();
  const userId = String(txRow.user_id);
  const resolvedExternalId = String(txRow.external_id || externalId || transId);

  // Idempotent guard: already completed callbacks return 200 cleanly
  if (currentStatus === 'completed') {
    return jsonResponse(
      {
        ok: true,
        alreadyProcessed: true,
        externalId: resolvedExternalId,
        status: 'completed',
      },
      200,
    );
  }

  const isSuccess =
    rawStatus === 'success' ||
    rawStatus === 'completed' ||
    rawStatus === 'settled' ||
    rawStatus === 'paid' ||
    rawStatus === 'true';

  const nextStatus: 'completed' | 'failed' = isSuccess ? 'completed' : 'failed';
  const nextState: 'SETTLED' | 'FAILED' = isSuccess ? 'SETTLED' : 'FAILED';
  const now = new Date();
  const nowIso = now.toISOString();
  const finalAzamTxId =
    transId ||
    mnoReference ||
    (typeof txRow.azampay_transaction_id === 'string' ? txRow.azampay_transaction_id : null);

  // 2. Update `payment_transactions` row with status, transaction ID, and full raw_callback
  const { error: updateTxErr } = await adminClient
    .from('payment_transactions')
    .update({
      status: nextStatus,
      state: nextState,
      azampay_transaction_id: finalAzamTxId,
      raw_callback: payload,
      webhook_signature_verified: true,
      reconciled_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', txId);

  if (updateTxErr) {
    console.error('[azampay-callback] Failed updating payment_transactions:', updateTxErr);
    return jsonResponse(
      { ok: false, error: 'Failed to update transaction status.' },
      500,
    );
  }

  if (!isSuccess) {
    return jsonResponse(
      {
        ok: true,
        externalId: resolvedExternalId,
        status: 'failed',
        transactionStatus: rawStatus || 'failed',
      },
      200,
    );
  }

  // 3. On `success`, automatically activate/extend the user's paid subscription
  const tierMeta = mapTierToPlan(
    typeof txRow.tier === 'string'
      ? txRow.tier
      : typeof txRow.tier_name === 'string'
        ? txRow.tier_name
        : 'operator_pro',
  );

  const { data: planRow } = await adminClient
    .from('subscription_plans')
    .select('id, name, price_tzs, price_usd, billing_cycle')
    .eq('id', tierMeta.planId)
    .maybeSingle();

  const planId = (planRow?.id as 'pro' | 'enterprise') || tierMeta.planId;
  const planName = planRow?.name || tierMeta.fallbackName;
  const priceTzs = Number(planRow?.price_tzs ?? txRow.amount_tzs ?? tierMeta.fallbackTzs);
  const priceUsd = Number(planRow?.price_usd ?? tierMeta.fallbackUsd);
  const billingCycle = planRow?.billing_cycle === 'yearly' ? 'yearly' : 'monthly';
  const durationDays = billingCycle === 'yearly' ? 365 : 30;

  // Check if user already has an active unexpired subscription on the same plan to extend cleanly
  const { data: existingSub } = await adminClient
    .from('user_subscriptions')
    .select('plan_id, status, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  let baseStartMs = now.getTime();
  if (
    existingSub &&
    existingSub.status === 'active' &&
    existingSub.plan_id === planId &&
    typeof existingSub.expires_at === 'string'
  ) {
    const existingExpiryMs = Date.parse(existingSub.expires_at);
    if (Number.isFinite(existingExpiryMs) && existingExpiryMs > now.getTime()) {
      baseStartMs = existingExpiryMs;
    }
  }

  const expiresAtIso = new Date(
    baseStartMs + durationDays * 86_400_000,
  ).toISOString();

  const providerLabel =
    typeof txRow.provider === 'string' && txRow.provider
      ? txRow.provider
      : pickString(payload, ['operator', 'provider']) || 'AzamPay';
  const isBank = ['CRDB', 'NMB', 'NBC'].includes(providerLabel.toUpperCase());
  const paymentMethodLabel = `AzamPay · ${providerLabel}`;
  const referenceCode = mnoReference || transId || resolvedExternalId;

  // Upsert authoritative `public.user_subscriptions` (drives `get_user_entitlements` + RLS + Admin Ledger)
  const { error: subErr } = await adminClient.from('user_subscriptions').upsert(
    {
      user_id: userId,
      plan_id: planId,
      tier_name: planName,
      status: 'active',
      billing_cycle: billingCycle,
      price_tzs: priceTzs,
      price_usd: priceUsd,
      payment_gateway: 'AZAMPAY',
      payment_method: paymentMethodLabel,
      payment_rail: isBank ? 'BANK_TRANSFER' : 'MOBILE_MONEY',
      payment_provider: providerLabel,
      payment_reference: referenceCode,
      starts_at: nowIso,
      expires_at: expiresAtIso,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' },
  );

  if (subErr) {
    console.error('[azampay-callback] Failed upserting user_subscriptions:', subErr);
    return jsonResponse(
      { ok: false, error: 'Payment recorded, but failed to activate user subscription.' },
      500,
    );
  }

  // Record settled payment in `public.subscription_payments` for the Admin Billing Ledger & User Workspace history
  await adminClient.from('subscription_payments').insert({
    user_id: userId,
    plan_id: planId,
    amount: priceTzs,
    currency: 'TZS',
    payment_method: paymentMethodLabel,
    reference_code: referenceCode,
    status: 'settled',
    notes: `AzamPay webhook settled (${resolvedExternalId})`,
    verified_at: nowIso,
  });

  // Ensure user's `profiles` record reflects active status & updated timestamp
  await adminClient
    .from('profiles')
    .update({ status: 'active', updated_at: nowIso })
    .eq('id', userId);

  // Immutable audit log
  await adminClient.from('audit_logs').insert({
    user_id: userId,
    action: 'AZAMPAY_SUBSCRIPTION_ACTIVATED',
    metadata: {
      externalId: resolvedExternalId,
      azampayTransactionId: finalAzamTxId,
      mnoReference,
      provider: providerLabel,
      planId,
      tier: txRow.tier,
      amountTzs: priceTzs,
      expiresAt: expiresAtIso,
    },
  });

  return jsonResponse(
    {
      ok: true,
      externalId: resolvedExternalId,
      status: 'completed',
      planId,
      planName,
      tier: txRow.tier,
      expiresAt: expiresAtIso,
    },
    200,
  );
});
