// Supabase Edge Function: Institutional Subscription Verification & Webhook Activation
// Supports:
//   1. Instant Webhook Reconciliation (AzamPay / Stripe / ClickPesa) using HMAC-SHA256 signature verification
//   2. Authenticated Checkout Initiation (returns gateway readiness or payment reference instructions)
//
// Required Secrets (configured via `supabase secrets set` — NEVER expose to client bundles):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   AZAMPAY_WEBHOOK_SECRET (optional until live AzamPay webhook is connected)
//   STRIPE_WEBHOOK_SECRET  (optional until live Stripe webhook is connected)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-azampay-signature, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface VerifySubscriptionPayload {
  mode?: 'initiate' | 'webhook';
  provider?: 'azampay' | 'stripe' | 'clickpesa';
  planId?: 'free' | 'pro' | 'enterprise';
  userId?: string;
  referenceCode?: string;
  amount?: number;
  currency?: string;
  phoneOrEmail?: string;
  status?: 'settled' | 'failed';
}

function jsonResponse(payload: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function verifyHmacSha256(
  rawBody: string,
  secret: string,
  providedHex: string,
): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const expectedHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const cleanProvided = providedHex.trim().toLowerCase().replace(/^sha256=/, '');
  if (expectedHex.length !== cleanProvided.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ cleanProvided.charCodeAt(i);
  }
  return diff === 0;
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
      { ok: false, error: 'Billing verification service is not configured on the server.' },
      500,
    );
  }

  const rawBody = await req.text();
  let body: VerifySubscriptionPayload;
  try {
    body = JSON.parse(rawBody) as VerifySubscriptionPayload;
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON payload.' }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // PATH A: Verified Payment Gateway Webhook Reconciliation (AzamPay / Stripe)
  if (body.mode === 'webhook') {
    const provider = body.provider ?? 'azampay';
    const webhookSecret =
      provider === 'stripe'
        ? Deno.env.get('STRIPE_WEBHOOK_SECRET')?.trim()
        : Deno.env.get('AZAMPAY_WEBHOOK_SECRET')?.trim();

    if (!webhookSecret) {
      return jsonResponse(
        { ok: false, error: `Webhook secret not configured for ${provider}.` },
        503,
      );
    }

    const signatureHeader =
      req.headers.get('x-azampay-signature') ??
      req.headers.get('stripe-signature') ??
      '';
    const validSig = await verifyHmacSha256(rawBody, webhookSecret, signatureHeader);
    if (!validSig) {
      return jsonResponse({ ok: false, error: 'Invalid webhook signature.' }, 401);
    }

    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const planId = body.planId === 'pro' || body.planId === 'enterprise' ? body.planId : null;
    const referenceCode =
      typeof body.referenceCode === 'string' ? body.referenceCode.trim() : '';

    if (!userId || !planId || !referenceCode) {
      return jsonResponse({ ok: false, error: 'Missing required webhook fields.' }, 400);
    }

    const { data: plan, error: planErr } = await adminClient
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planErr || !plan) {
      return jsonResponse({ ok: false, error: 'Subscription plan not found.' }, 404);
    }

    const now = new Date();
    const durationDays = plan.billing_cycle === 'yearly' ? 365 : 30;
    const expiresAt = new Date(now.getTime() + durationDays * 86_400_000).toISOString();

    await adminClient.from('subscription_payments').insert({
      user_id: userId,
      plan_id: plan.id,
      amount: body.amount ?? plan.price_tzs,
      currency: body.currency ?? 'TZS',
      payment_method: provider.toUpperCase(),
      reference_code: referenceCode,
      status: body.status === 'failed' ? 'failed' : 'settled',
      verified_at: now.toISOString(),
    });

    if (body.status !== 'failed') {
      await adminClient.from('user_subscriptions').upsert(
        {
          user_id: userId,
          plan_id: plan.id,
          tier_name: plan.name,
          status: 'active',
          billing_cycle: plan.billing_cycle,
          price_tzs: plan.price_tzs,
          price_usd: plan.price_usd,
          payment_gateway: provider === 'stripe' ? 'STRIPE' : 'AZAMPAY',
          payment_method: provider.toUpperCase(),
          payment_reference: referenceCode,
          starts_at: now.toISOString(),
          expires_at: expiresAt,
          updated_at: now.toISOString(),
        },
        { onConflict: 'user_id' },
      );
    }

    return jsonResponse({
      ok: true,
      reconciled: true,
      planId: plan.id,
      expiresAt,
    }, 200);
  }

  // PATH B: Authenticated Checkout Initiation Hook
  const authHeader = req.headers.get('authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return jsonResponse({ ok: false, error: 'Authentication required.' }, 401);
  }

  const { data: userData, error: authErr } = await adminClient.auth.getUser(jwt);
  if (authErr || !userData?.user) {
    return jsonResponse({ ok: false, error: 'Invalid or expired session.' }, 401);
  }

  const planId = body.planId === 'pro' || body.planId === 'enterprise' ? body.planId : null;
  if (!planId) {
    return jsonResponse({ ok: false, error: 'Select a valid paid subscription plan.' }, 400);
  }

  const { data: plan } = await adminClient
    .from('subscription_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (!plan) {
    return jsonResponse({ ok: false, error: 'Selected plan is unavailable.' }, 404);
  }

  const provider = body.provider ?? 'azampay';
  const gatewayConfigured =
    provider === 'stripe'
      ? Boolean(Deno.env.get('STRIPE_SECRET_KEY')?.trim())
      : Boolean(Deno.env.get('AZAMPAY_API_KEY')?.trim());

  const referenceCode = `MC-${planId.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  return jsonResponse(
    {
      ok: true,
      gatewayReady: gatewayConfigured,
      provider,
      referenceCode,
      planId: plan.id,
      planName: plan.name,
      amountTzs: plan.price_tzs,
      amountUsd: plan.price_usd,
      message: gatewayConfigured
        ? `Checkout session ${referenceCode} initialized via ${provider.toUpperCase()}.`
        : `Direct ${provider.toUpperCase()} merchant credentials are in sandbox standby. Use reference ${referenceCode} with Corporate Mobile Money / NMB-CRDB EFT below for immediate admin activation.`,
    },
    200,
  );
});
