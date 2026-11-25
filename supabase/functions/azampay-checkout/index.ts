// Supabase Edge Function: AzamPay Mobile Money (MNO) & Bank Checkout
// Validates user JWT, persists a `pending` row in `public.payment_transactions`,
// authenticates against AzamPay Token API, and triggers MNO STK push or Bank checkout.
//
// Required Secrets (configured server-side via `supabase secrets set`):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   AZAMPAY_APP_NAME
//   AZAMPAY_CLIENT_ID
//   AZAMPAY_CLIENT_SECRET
//   AZAMPAY_ENV ('sandbox' | 'production')
//   TURNSTILE_SECRET_KEY (optional)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TURNSTILE_SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type AzamPayMnoProvider = 'Mpesa' | 'Tigo' | 'Airtel' | 'Halopesa' | 'Azampesa';
type AzamPayBankProvider = 'CRDB' | 'NMB' | 'NBC';
type AzamPayProvider = AzamPayMnoProvider | AzamPayBankProvider;
type CanonicalTier = 'operator_pro' | 'institutional_jv';

interface CheckoutRequestBody {
  tier?: string;
  planId?: string;
  provider?: string;
  phoneNumber?: string;
  accountNumber?: string;
  merchantMobileNumber?: string;
  otp?: string;
  turnstileToken?: string;
  turnstileBypassReason?: string;
}

const MNO_PROVIDERS = new Set<string>([
  'Mpesa',
  'Tigo',
  'Airtel',
  'Halopesa',
  'Azampesa',
]);

const BANK_PROVIDERS = new Set<string>(['CRDB', 'NMB', 'NBC']);

function jsonResponse(payload: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function normalizeProvider(raw?: string): AzamPayProvider | null {
  const clean = (raw ?? '').trim().toLowerCase();
  if (!clean) return null;
  if (clean === 'mpesa' || clean.includes('m-pesa') || clean.includes('vodacom')) {
    return 'Mpesa';
  }
  if (
    clean === 'tigo' ||
    clean.includes('tigo') ||
    clean.includes('yas') ||
    clean.includes('mixx')
  ) {
    return 'Tigo';
  }
  if (clean === 'airtel' || clean.includes('airtel')) {
    return 'Airtel';
  }
  if (clean === 'halopesa' || clean.includes('halotel') || clean.includes('halo')) {
    return 'Halopesa';
  }
  if (clean === 'azampesa' || clean.includes('azam')) {
    return 'Azampesa';
  }
  if (clean === 'crdb' || clean.includes('crdb')) {
    return 'CRDB';
  }
  if (clean === 'nmb' || clean.includes('nmb')) {
    return 'NMB';
  }
  if (clean === 'nbc' || clean.includes('nbc')) {
    return 'NBC';
  }
  return null;
}

function normalizeTier(
  tierInput?: string,
  planIdInput?: string,
): { tier: CanonicalTier; planId: 'pro' | 'enterprise'; fallbackName: string; fallbackTzs: number; fallbackUsd: number } | null {
  const raw = (tierInput || planIdInput || '').trim().toLowerCase();
  if (
    raw === 'operator_pro' ||
    raw === 'pro' ||
    raw === 'operator pro' ||
    raw === 'professional'
  ) {
    return {
      tier: 'operator_pro',
      planId: 'pro',
      fallbackName: 'Operator Pro',
      fallbackTzs: 120_000,
      fallbackUsd: 45,
    };
  }
  if (
    raw === 'institutional_jv' ||
    raw === 'enterprise' ||
    raw === 'institutional' ||
    raw === 'institutional / jv desk'
  ) {
    return {
      tier: 'institutional_jv',
      planId: 'enterprise',
      fallbackName: 'Institutional / JV Desk',
      fallbackTzs: 450_000,
      fallbackUsd: 170,
    };
  }
  return null;
}

/**
 * Formats Tanzania phone numbers into canonical AzamPay MSISDN (`255XXXXXXXXX` or `0XXXXXXXXX`).
 * AzamPay MNO sandbox & production reliably accept `2557XXXXXXXX` (12 digits) or `07XXXXXXXX` (10 digits).
 */
function formatTanzaniaPhone(raw: string): { valid: boolean; msisdn: string; masked: string } {
  const digits = raw.replace(/[^0-9]/g, '');
  let msisdn = '';
  if (digits.startsWith('255') && digits.length === 12) {
    msisdn = digits;
  } else if (digits.startsWith('0') && digits.length === 10) {
    msisdn = `255${digits.slice(1)}`;
  } else if (digits.length === 9 && /^[67]/.test(digits)) {
    msisdn = `255${digits}`;
  } else {
    return { valid: false, msisdn: '', masked: '' };
  }

  const masked = `${msisdn.slice(0, 6)}***${msisdn.slice(-3)}`;
  return { valid: true, msisdn, masked };
}

function maskGenericAccount(raw: string): string {
  const clean = raw.trim();
  if (clean.length <= 6) return clean;
  return `${clean.slice(0, 4)}••••${clean.slice(-3)}`;
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
      { ok: false, error: 'Supabase server configuration is missing.' },
      500,
    );
  }

  // 1. Validate logged-in user JWT from Authorization header
  const token = (req.headers.get('Authorization') ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (!token) {
    return jsonResponse(
      {
        ok: false,
        error: 'User Auth Error: Missing Authorization bearer token. Please sign in again.',
      },
      401,
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !userData?.user) {
    console.error('User Auth Error:', authErr?.message || 'No user returned');
    return jsonResponse(
      {
        ok: false,
        error: `User Auth Error: ${authErr?.message || 'Invalid or expired session. Please sign in again.'}`,
      },
      401,
    );
  }
  const user = userData.user;
  const adminClient = supabaseAdmin;

  // 2. Parse and validate request payload
  let body: CheckoutRequestBody;
  try {
    body = (await req.json()) as CheckoutRequestBody;
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON request body.' }, 400);
  }

  const resolvedTier = normalizeTier(body.tier, body.planId);
  if (!resolvedTier) {
    return jsonResponse(
      {
        ok: false,
        error: 'Invalid subscription tier. Choose Operator Pro or Institutional / JV Desk.',
      },
      400,
    );
  }

  const provider = normalizeProvider(body.provider);
  if (!provider) {
    return jsonResponse(
      {
        ok: false,
        error:
          'Unsupported payment provider. Select Vodacom (M-Pesa), Yas/Mixx (Tigo), Airtel Money, Halotel (Halopesa), AzamPesa, CRDB, NMB, or NBC.',
      },
      400,
    );
  }

  const isBank = BANK_PROVIDERS.has(provider);
  const isMno = MNO_PROVIDERS.has(provider);
  const rawContact = (body.phoneNumber || body.accountNumber || '').trim();

  let accountNumber = '';
  let phoneNumberForDb = '';
  let maskedContact = '';

  if (isMno) {
    const parsedPhone = formatTanzaniaPhone(rawContact);
    if (!parsedPhone.valid) {
      return jsonResponse(
        {
          ok: false,
          error:
            'Enter a valid Tanzania Mobile Money number (e.g. 07XX XXX XXX or 2557XX XXX XXX).',
        },
        400,
      );
    }
    accountNumber = parsedPhone.msisdn;
    phoneNumberForDb = parsedPhone.msisdn;
    maskedContact = parsedPhone.masked;
  } else {
    if (rawContact.length < 4) {
      return jsonResponse(
        {
          ok: false,
          error: 'Enter a valid bank account number or mobile number for bank transfer.',
        },
        400,
      );
    }
    accountNumber = rawContact;
    phoneNumberForDb = rawContact;
    maskedContact = maskGenericAccount(rawContact);
  }

  // Per-user checkout rate limiting (max 8 attempts per 10 minutes via payment_transactions)
  const tenMinutesAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentAttempts } = await adminClient
    .from('payment_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', tenMinutesAgoIso);

  if (typeof recentAttempts === 'number' && recentAttempts >= 8) {
    return jsonResponse(
      {
        ok: false,
        error:
          'Too many checkout attempts in the last 10 minutes. Please wait a moment before retrying.',
      },
      429,
    );
  }

  // Cloudflare Turnstile verification whenever a valid token is provided;
  // when mobile/cellular widget timed out (`timeout_or_mobile_challenge`), the verified
  // Supabase user JWT + per-user DB checkout rate limit above protects the endpoint.
  const turnstileSecret = Deno.env
    .get('TURNSTILE_SECRET_KEY')
    ?.trim()
    .replace(/^["']|["']$/g, '');
  const bypassReason =
    typeof body.turnstileBypassReason === 'string'
      ? body.turnstileBypassReason.trim()
      : '';
  let turnstileVerificationMode = 'jwt_rate_limited';

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
          { ok: false, error: 'Security verification failed. Please retry the check.' },
          400,
        );
      }
      turnstileVerificationMode = 'turnstile_verified';
    } catch {
      turnstileVerificationMode = 'turnstile_upstream_fallback';
    }
  } else if (bypassReason === 'timeout_or_mobile_challenge') {
    turnstileVerificationMode = 'timeout_or_mobile_challenge_jwt_verified';
  }

  // 3. Verify & trim AzamPay credentials
  const cleanSecret = (val?: string | null): string =>
    (val ?? '').trim().replace(/^["']|["']$/g, '');

  const appName = cleanSecret(Deno.env.get('AZAMPAY_APP_NAME')) || 'MineConnect';
  const clientId = cleanSecret(Deno.env.get('AZAMPAY_CLIENT_ID'));
  const clientSecret = cleanSecret(Deno.env.get('AZAMPAY_CLIENT_SECRET'));
  const apiToken = cleanSecret(Deno.env.get('AZAMPAY_TOKEN'));
  const azamEnv =
    (cleanSecret(Deno.env.get('AZAMPAY_ENV')) || 'sandbox').toLowerCase() === 'production'
      ? 'production'
      : 'sandbox';

  if (!appName || !clientId || !clientSecret) {
    console.error('[azampay-checkout] Missing AzamPay env secrets:', {
      hasAppName: Boolean(appName),
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
      hasApiToken: Boolean(apiToken),
      env: azamEnv,
    });
    return jsonResponse(
      {
        ok: false,
        error:
          'AzamPay gateway credentials are not configured on the server. Set AZAMPAY_APP_NAME, AZAMPAY_CLIENT_ID, and AZAMPAY_CLIENT_SECRET.',
      },
      503,
    );
  }

  // 4. Authoritative server-side plan pricing lookup from `subscription_plans`
  const { data: planRow } = await adminClient
    .from('subscription_plans')
    .select('id, name, price_tzs, price_usd, billing_cycle')
    .eq('id', resolvedTier.planId)
    .maybeSingle();

  const planName = planRow?.name || resolvedTier.fallbackName;
  const amountTzs = Number(planRow?.price_tzs ?? resolvedTier.fallbackTzs);
  const amountUsd = Number(planRow?.price_usd ?? resolvedTier.fallbackUsd);

  // 5. Generate unique externalId and insert `pending` record into `payment_transactions`
  const externalId = `MC-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const nowIso = new Date().toISOString();

  const { data: txRow, error: insertErr } = await adminClient
    .from('payment_transactions')
    .insert({
      user_id: user.id,
      external_id: externalId,
      provider,
      phone_number: phoneNumberForDb,
      amount_tzs: amountTzs,
      tier: resolvedTier.tier,
      status: 'pending',
      // Legacy compatibility fields
      idempotency_key: externalId,
      clickpesa_order_id: externalId,
      tier_name: planName,
      billing_cycle: planRow?.billing_cycle || 'monthly',
      gateway: 'AZAMPAY',
      rail: isBank ? 'BANK_TRANSFER' : 'MOBILE_MONEY',
      provider_code: provider,
      payment_method_label: `AzamPay · ${provider}`,
      account_or_phone_masked: maskedContact,
      verified_amount_tzs: amountTzs,
      verified_amount_usd: amountUsd,
      charged_currency: 'TZS',
      charged_amount: amountTzs,
      state: 'INITIATED',
      metadata: {
        env: azamEnv,
        planId: resolvedTier.planId,
        tier: resolvedTier.tier,
        turnstileVerificationMode,
        initiatedAt: nowIso,
      },
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('id, external_id, status')
    .single();

  if (insertErr || !txRow) {
    console.error('[azampay-checkout] Failed inserting pending transaction:', insertErr);
    return jsonResponse(
      {
        ok: false,
        error: 'Could not initialize payment transaction in database.',
      },
      500,
    );
  }

  // 6. Step 1 — Explicit `GenerateToken` Exchange With Full Logging
  const tokenUrl =
    azamEnv === 'production'
      ? 'https://authenticator.azampay.co.tz/AppRegistration/GenerateToken'
      : 'https://authenticator-sandbox.azampay.co.tz/AppRegistration/GenerateToken';
  const checkoutBaseUrl =
    azamEnv === 'production'
      ? 'https://checkout.azampay.co.tz'
      : 'https://sandbox.azampay.co.tz';

  let accessToken = '';
  try {
    const tokenHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(apiToken ? { 'X-API-Key': apiToken } : {}),
    };

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: tokenHeaders,
      body: JSON.stringify({
        appName,
        clientId,
        clientSecret,
      }),
    });

    const rawText = await tokenRes.text();
    let json: {
      success?: boolean;
      message?: string;
      accessToken?: string;
      data?: { accessToken?: string; expire?: string };
      Data?: { accessToken?: string; expire?: string };
    } = {};
    try {
      json = rawText ? JSON.parse(rawText) : {};
    } catch {
      json = { message: rawText };
    }

    const rawAccessToken =
      json?.data?.accessToken ??
      json?.accessToken ??
      json?.Data?.accessToken ??
      '';
    accessToken = String(rawAccessToken).replace(/^Bearer\s+/i, '').trim();

    if (!tokenRes.ok || !accessToken) {
      console.error('[azampay-token-failed]', {
        status: tokenRes.status,
        body: rawText,
        appName,
        env: azamEnv,
        hasClientId: Boolean(clientId),
        hasClientSecret: Boolean(clientSecret),
        hasApiToken: Boolean(apiToken),
      });
      const errDetail =
        json?.message || rawText || 'No accessToken returned';
      await adminClient
        .from('payment_transactions')
        .update({
          status: 'failed',
          state: 'FAILED',
          raw_callback: { stage: 'token', status: tokenRes.status, response: json },
          updated_at: new Date().toISOString(),
        })
        .eq('id', txRow.id);

      return jsonResponse(
        {
          ok: false,
          error: `AzamPay Token Error (${tokenRes.status}): ${errDetail}`,
        },
        502,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to reach AzamPay authenticator.';
    console.error('[azampay-token-failed]', { stage: 'network', message: msg, appName, env: azamEnv });
    await adminClient
      .from('payment_transactions')
      .update({
        status: 'failed',
        state: 'FAILED',
        raw_callback: { stage: 'token_network_error', message: msg },
        updated_at: new Date().toISOString(),
      })
      .eq('id', txRow.id);

    return jsonResponse(
      { ok: false, error: `AzamPay Token Error (network): ${msg}` },
      502,
    );
  }

  // 7. Step 2 — MNO / Bank Checkout Request With Authorization: Bearer + X-API-Key & Auth Retries
  try {
    const endpoint = isMno
      ? `${checkoutBaseUrl}/azampay/mno/checkout`
      : `${checkoutBaseUrl}/azampay/bank/checkout`;

    const mobilePhoneDigits = body.merchantMobileNumber
      ? formatTanzaniaPhone(body.merchantMobileNumber)
      : formatTanzaniaPhone(accountNumber);

    const roundedAmount = String(Math.round(Number(amountTzs)));

    const requestPayload = isMno
      ? {
          accountNumber,
          amount: roundedAmount,
          currency: 'TZS',
          externalId,
          provider,
        }
      : {
          merchantAccountNumber: accountNumber,
          merchantMobileNumber: mobilePhoneDigits.valid
            ? mobilePhoneDigits.msisdn
            : accountNumber,
          merchantName: 'MineConnect',
          amount: roundedAmount,
          currencyCode: 'TZS',
          referenceId: externalId,
          provider,
          ...(body.otp?.trim() ? { otp: body.otp.trim() } : {}),
        };

    const parseJsonSafe = (raw: string): Record<string, unknown> => {
      try {
        return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        return { rawText: raw };
      }
    };

    const isAuthorizationRejection = (
      res: Response,
      parsed: Record<string, unknown>,
    ): boolean => {
      if (res.status === 401) return true;
      const msg = `${String(parsed.message ?? '')} ${String(parsed.rawText ?? '')}`;
      return /please provide valid authorization|unauthorized|invalid.*authorization/i.test(msg);
    };

    const sendCheckout = async (
      strategy: 'bearer_and_apikey' | 'bearer_only' | 'apitoken_auth_and_apikey',
      headers: Record<string, string>,
    ) => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestPayload),
      });
      const text = await res.text();
      return { res, rawText: text, json: parseJsonSafe(text), strategy };
    };

    // Attempt 1: Authorization: Bearer <accessToken> + X-API-Key (when apiToken is configured)
    let attempt = await sendCheckout(
      apiToken ? 'bearer_and_apikey' : 'bearer_only',
      {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(apiToken ? { 'X-API-Key': apiToken } : {}),
      },
    );

    // Attempt 2: If X-API-Key was sent and AzamPay returned 401 or "Please Provide Valid Authorization",
    // retry once with ONLY Content-Type, Accept, and Authorization: Bearer <accessToken>
    if (
      apiToken &&
      attempt.strategy === 'bearer_and_apikey' &&
      isAuthorizationRejection(attempt.res, attempt.json)
    ) {
      console.warn('[azampay-checkout-retry]', {
        previousStrategy: attempt.strategy,
        status: attempt.res.status,
        body: attempt.rawText,
        nextStrategy: 'bearer_only',
      });
      attempt = await sendCheckout('bearer_only', {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      });
    }

    // Attempt 3: If Bearer-only returned 401 or "Please Provide Valid Authorization" and apiToken exists,
    // retry once with X-API-Key: apiToken and Authorization: apiToken
    if (
      apiToken &&
      attempt.strategy === 'bearer_only' &&
      isAuthorizationRejection(attempt.res, attempt.json)
    ) {
      console.warn('[azampay-checkout-retry]', {
        previousStrategy: attempt.strategy,
        status: attempt.res.status,
        body: attempt.rawText,
        nextStrategy: 'apitoken_auth_and_apikey',
      });
      attempt = await sendCheckout('apitoken_auth_and_apikey', {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-Key': apiToken,
        Authorization: apiToken,
      });
    }

    const checkoutRes = attempt.res;
    const checkoutJson = attempt.json;

    const azamSuccess =
      checkoutRes.ok && checkoutJson.success !== false;

    const azampayTransactionId =
      typeof checkoutJson.transactionId === 'string'
        ? checkoutJson.transactionId
        : typeof (checkoutJson.data as Record<string, unknown> | undefined)?.transactionId === 'string'
          ? String((checkoutJson.data as Record<string, unknown>).transactionId)
          : null;

    if (!azamSuccess) {
      console.error('[azampay-checkout-failed]', {
        status: checkoutRes.status,
        strategy: attempt.strategy,
        env: azamEnv,
        provider,
        hasApiToken: Boolean(apiToken),
        body: attempt.rawText,
        parsed: checkoutJson,
      });
      const rawFailure =
        typeof checkoutJson.message === 'string' && checkoutJson.message.trim()
          ? checkoutJson.message.trim()
          : attempt.rawText.trim() || `${provider} checkout declined (HTTP ${checkoutRes.status}).`;

      await adminClient
        .from('payment_transactions')
        .update({
          status: 'failed',
          state: 'FAILED',
          azampay_transaction_id: azampayTransactionId,
          raw_callback: {
            stage: 'checkout',
            httpStatus: checkoutRes.status,
            authStrategy: attempt.strategy,
            response: checkoutJson,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', txRow.id);

      return jsonResponse(
        {
          ok: false,
          externalId,
          error: `AzamPay Checkout Error (${checkoutRes.status}): ${rawFailure}`,
          azampayResponse: checkoutJson,
        },
        400,
      );
    }

    // Checkout request accepted — keep transaction `pending` until webhook settles
    await adminClient
      .from('payment_transactions')
      .update({
        azampay_transaction_id: azampayTransactionId,
        state: 'PROCESSING',
        metadata: {
          env: azamEnv,
          planId: resolvedTier.planId,
          tier: resolvedTier.tier,
          checkoutResponse: checkoutJson,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', txRow.id);

    return jsonResponse(
      {
        ok: true,
        externalId,
        transactionId: txRow.id,
        azampayTransactionId,
        provider,
        channel: isBank ? 'bank' : 'mno',
        amountTzs,
        tier: resolvedTier.tier,
        planId: resolvedTier.planId,
        planName,
        status: 'pending',
        environment: azamEnv,
        message:
          typeof checkoutJson.message === 'string' && checkoutJson.message.trim()
            ? checkoutJson.message
            : isMno
              ? 'Check your phone to enter your Mobile Money PIN.'
              : `Bank checkout initiated with ${provider}. Complete authorization to unlock your plan.`,
      },
      200,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unable to reach AzamPay checkout API.';
    console.error('AzamPay Checkout Error:', msg);
    await adminClient
      .from('payment_transactions')
      .update({
        status: 'failed',
        state: 'FAILED',
        raw_callback: { stage: 'checkout_network_error', message: msg },
        updated_at: new Date().toISOString(),
      })
      .eq('id', txRow.id);

    return jsonResponse({ ok: false, error: `AzamPay Checkout Error: ${msg}` }, 502);
  }
});
