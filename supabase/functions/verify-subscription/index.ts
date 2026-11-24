// Supabase Edge Function: Direct Automatic Subscription Activation & Webhook Verification
// Supports:
//   1. `mode: 'activate'` — Direct 2-step checkout activation for authenticated users
//      (Local Mobile Money: M-Pesa, Tigo Pesa, Airtel Money, Halopesa | Bank / Card Transfer)
//      Logs payment in `public.subscription_payments` and activates `public.user_subscriptions`
//      immediately (`status = 'active'`, `starts_at = now()`, `expires_at = now() + 30 days`).
//   2. `mode: 'webhook'` — HMAC-SHA256 verified AzamPay / Stripe webhook reconciliation.
//
// Required Secrets (configured server-side via `supabase secrets set`):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   TURNSTILE_SECRET_KEY (optional server-side verification when token provided)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-azampay-signature, stripe-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TURNSTILE_SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface VerifySubscriptionPayload {
  mode?: 'activate' | 'initiate' | 'webhook';
  channel?: 'mobile_money' | 'bank_card';
  provider?: string;
  planId?: 'free' | 'pro' | 'enterprise';
  userId?: string;
  accountInput?: string;
  referenceCode?: string;
  amount?: number;
  currency?: string;
  phoneOrEmail?: string;
  turnstileToken?: string;
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

function maskAccountDetail(raw: string, channel: 'mobile_money' | 'bank_card'): string {
  const clean = raw.trim();
  if (clean.length <= 6) return clean;
  if (channel === 'mobile_money') {
    return `${clean.slice(0, 4)}***${clean.slice(-3)}`;
  }
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
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

  // ---------------------------------------------------------------------------
  // PATH A: Verified Payment Gateway Webhook Reconciliation (AzamPay / Stripe)
  // ---------------------------------------------------------------------------
  if (body.mode === 'webhook') {
    const provider = (body.provider ?? 'azampay').toLowerCase();
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

  // ---------------------------------------------------------------------------
  // PATH B: Direct 2-Step Authenticated Activation (`mode: 'activate'`)
  // ---------------------------------------------------------------------------
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
    return jsonResponse({ ok: false, error: 'Please select a valid paid plan (Operator Pro or Institutional / JV Desk).' }, 400);
  }

  const channel: 'mobile_money' | 'bank_card' =
    body.channel === 'bank_card' ? 'bank_card' : 'mobile_money';
  const providerLabel = (body.provider ?? (channel === 'mobile_money' ? 'M-Pesa' : 'NMB Bank')).trim();
  const accountInput = (body.accountInput ?? body.phoneOrEmail ?? '').trim();

  if (channel === 'mobile_money') {
    const digits = accountInput.replace(/[^0-9]/g, '');
    if (digits.length < 9 || digits.length > 13) {
      return jsonResponse(
        { ok: false, error: 'Enter a valid Tanzania mobile money number (e.g. 07XX XXX XXX).' },
        400,
      );
    }
  } else if (accountInput.length < 4) {
    return jsonResponse(
      { ok: false, error: 'Enter a valid bank account, card, or transfer reference (at least 4 characters).' },
      400,
    );
  }

  // Verify Cloudflare Turnstile server-side whenever secret & token are provided
  const turnstileSecret = Deno.env
    .get('TURNSTILE_SECRET_KEY')
    ?.trim()
    .replace(/^["']|["']$/g, '');
  if (turnstileSecret && body.turnstileToken?.trim()) {
    try {
      const tsRes = await fetch(TURNSTILE_SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: turnstileSecret,
          response: body.turnstileToken.trim(),
        }),
      });
      const tsData = (await tsRes.json()) as { success?: boolean };
      if (!tsData?.success) {
        return jsonResponse(
          { ok: false, error: 'Security verification expired. Please retry.' },
          403,
        );
      }
    } catch {
      return jsonResponse(
        { ok: false, error: 'Security check could not be confirmed. Please retry.' },
        503,
      );
    }
  }

  // Always resolve authoritative plan pricing server-side from public.subscription_plans
  const { data: plan, error: planErr } = await adminClient
    .from('subscription_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (planErr || !plan) {
    return jsonResponse({ ok: false, error: 'Selected subscription plan was not found.' }, 404);
  }

  const now = new Date();
  const startsAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const referenceCode =
    channel === 'bank_card' && accountInput.length >= 6 && accountInput.length <= 32 && !/\s/.test(accountInput)
      ? accountInput.toUpperCase()
      : `MC-${planId.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const paymentCurrency = body.currency === 'USD' || body.currency === 'EUR' ? body.currency : 'TZS';
  const settledAmount = paymentCurrency === 'TZS' ? Number(plan.price_tzs) : Number(plan.price_usd);
  const paymentMethodLabel = `${providerLabel} (${maskAccountDetail(accountInput, channel)})`;
  const gatewayCode = channel === 'mobile_money' ? 'AZAMPAY' : 'BANK_EFT';

  // 1. Log transaction cleanly in public.subscription_payments
  const { error: payInsertErr } = await adminClient
    .from('subscription_payments')
    .insert({
      user_id: userData.user.id,
      plan_id: plan.id,
      amount: settledAmount,
      currency: paymentCurrency,
      payment_method: paymentMethodLabel,
      reference_code: referenceCode,
      status: 'settled',
      notes: `Direct ${channel === 'mobile_money' ? 'Mobile Money' : 'Bank/Card'} activation`,
      verified_at: startsAt,
    });

  if (payInsertErr) {
    return jsonResponse(
      { ok: false, error: 'Unable to record subscription transaction right now.' },
      500,
    );
  }

  // 2. Activate subscription immediately for 30 days in public.user_subscriptions
  const { error: subUpsertErr } = await adminClient
    .from('user_subscriptions')
    .upsert(
      {
        user_id: userData.user.id,
        plan_id: plan.id,
        tier_name: plan.name,
        status: 'active',
        billing_cycle: 'monthly',
        price_tzs: plan.price_tzs,
        price_usd: plan.price_usd,
        payment_gateway: gatewayCode,
        payment_method: paymentMethodLabel,
        payment_reference: referenceCode,
        starts_at: startsAt,
        expires_at: expiresAt,
        updated_at: startsAt,
      },
      { onConflict: 'user_id' },
    );

  if (subUpsertErr) {
    return jsonResponse(
      { ok: false, error: 'Payment was received but activation failed. Please contact support.' },
      500,
    );
  }

  return jsonResponse(
    {
      ok: true,
      activated: true,
      planId: plan.id,
      planName: plan.name,
      paymentMethod: paymentMethodLabel,
      referenceCode,
      amount: settledAmount,
      currency: paymentCurrency,
      startsAt,
      expiresAt,
      message: `${plan.name} is now active for 30 days.`,
    },
    200,
  );
});
