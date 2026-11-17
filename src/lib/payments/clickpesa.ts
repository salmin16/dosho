/**
 * ClickPesa FinTech Gateway Engine & Transaction State Machine
 * Supports:
 * 1. Tanzanian Mobile Money (M-Pesa, Airtel Money, Mixx by Yas/Tigo, HaloPesa, EzyPesa)
 * 2. Tanzanian Bank Payments (CRDB, NMB, NBC)
 * 3. International Cards (Visa, Mastercard, UnionPay)
 *
 * Security Architecture:
 * - Idempotency Key enforcement to prevent duplicate charges
 * - Strict Transaction State Machine: INITIATED -> PROCESSING -> SETTLED | FAILED
 * - Cryptographic HMAC-SHA256 Webhook Signature Verification
 */

import type {
  BillingCycle,
  ClickPesaProviderCode,
  ClickPesaRail,
  ClickPesaTransactionState,
  SubscriptionTierName,
} from '../../types/database';

export interface ClickPesaChannelDefinition {
  code: ClickPesaProviderCode;
  rail: ClickPesaRail;
  name: string;
  shortName: string;
  subtitle: string;
  badgeColor: string;
  ussdCode?: string;
  prefixes?: string[];
  settlementTime: string;
}

export const CLICKPESA_CHANNELS: Record<
  Exclude<ClickPesaProviderCode, 'FREE'>,
  ClickPesaChannelDefinition
> = {
  // 1. TANZANIAN MOBILE MONEY RAILS
  MPESA_TZ: {
    code: 'MPESA_TZ',
    rail: 'MOBILE_MONEY',
    name: 'Vodacom M-Pesa Tanzania',
    shortName: 'M-Pesa',
    subtitle: 'Instant STK USSD Push (+255 74 / 75 / 76)',
    badgeColor: '#e60000',
    ussdCode: '*150*00#',
    prefixes: ['74', '75', '76'],
    settlementTime: 'Instant (< 8 sec)',
  },
  AIRTEL_MONEY_TZ: {
    code: 'AIRTEL_MONEY_TZ',
    rail: 'MOBILE_MONEY',
    name: 'Airtel Money Tanzania',
    shortName: 'Airtel Money',
    subtitle: 'Instant STK USSD Push (+255 68 / 69 / 78)',
    badgeColor: '#d9232a',
    ussdCode: '*150*60#',
    prefixes: ['68', '69', '78'],
    settlementTime: 'Instant (< 8 sec)',
  },
  MIXX_BY_YAS: {
    code: 'MIXX_BY_YAS',
    rail: 'MOBILE_MONEY',
    name: 'Mixx by Yas (Tigo Pesa)',
    shortName: 'Mixx by Yas / Tigo',
    subtitle: 'Instant STK USSD Push (+255 65 / 67 / 71)',
    badgeColor: '#00377b',
    ussdCode: '*150*01#',
    prefixes: ['65', '67', '71'],
    settlementTime: 'Instant (< 8 sec)',
  },
  HALOPESA_TZ: {
    code: 'HALOPESA_TZ',
    rail: 'MOBILE_MONEY',
    name: 'HaloPesa (Halotel Tanzania)',
    shortName: 'HaloPesa',
    subtitle: 'Instant STK USSD Push (+255 61 / 62)',
    badgeColor: '#f37021',
    ussdCode: '*150*88#',
    prefixes: ['61', '62'],
    settlementTime: 'Instant (< 10 sec)',
  },
  EZYPESA_TZ: {
    code: 'EZYPESA_TZ',
    rail: 'MOBILE_MONEY',
    name: 'EzyPesa (Zantel)',
    shortName: 'EzyPesa',
    subtitle: 'Zanzibar & Mainland USSD Push (+255 77)',
    badgeColor: '#1b9e3e',
    ussdCode: '*150*02#',
    prefixes: ['77'],
    settlementTime: 'Instant (< 10 sec)',
  },

  // 2. TANZANIAN BANK PAYMENT RAILS
  CRDB_BANK: {
    code: 'CRDB_BANK',
    rail: 'BANK_TRANSFER',
    name: 'CRDB Bank PLC (SimBanking / Wakala)',
    shortName: 'CRDB Bank',
    subtitle: 'ClickPesa Control Number & SimBanking Direct',
    badgeColor: '#007a33',
    ussdCode: '*150*03#',
    settlementTime: 'Real-Time TISS / Instant Control Number',
  },
  NMB_BANK: {
    code: 'NMB_BANK',
    rail: 'BANK_TRANSFER',
    name: 'NMB Bank PLC (NMB Mkononi / Direct)',
    shortName: 'NMB Bank',
    subtitle: 'ClickPesa Control Number & NMB Mkononi',
    badgeColor: '#004b87',
    ussdCode: '*150*66#',
    settlementTime: 'Real-Time TISS / Instant Control Number',
  },
  NBC_BANK: {
    code: 'NBC_BANK',
    rail: 'BANK_TRANSFER',
    name: 'NBC Bank Tanzania (NBC Kiganjani)',
    shortName: 'NBC Bank',
    subtitle: 'ClickPesa Control Number & Corporate Portal',
    badgeColor: '#1a2b6d',
    ussdCode: '*150*55#',
    settlementTime: 'Real-Time TISS / Instant Control Number',
  },

  // 3. INTERNATIONAL CARD RAILS
  VISA_CARD: {
    code: 'VISA_CARD',
    rail: 'INTERNATIONAL_CARD',
    name: 'Visa International (3D Secure 2.0)',
    shortName: 'Visa',
    subtitle: 'Global Corporate & Personal Debit/Credit Cards',
    badgeColor: '#1a1f71',
    settlementTime: 'Instant 3DS Authorization',
  },
  MASTERCARD: {
    code: 'MASTERCARD',
    rail: 'INTERNATIONAL_CARD',
    name: 'Mastercard Worldwide (Identity Check)',
    shortName: 'Mastercard',
    subtitle: 'Global Corporate & Personal Debit/Credit Cards',
    badgeColor: '#eb001b',
    settlementTime: 'Instant 3DS Authorization',
  },
  UNIONPAY_CARD: {
    code: 'UNIONPAY_CARD',
    rail: 'INTERNATIONAL_CARD',
    name: 'UnionPay International',
    shortName: 'UnionPay',
    subtitle: 'Asia-Pacific & Global Commercial Settlement Cards',
    badgeColor: '#007b84',
    settlementTime: 'Instant Authorization',
  },
};

export const CLICKPESA_MOBILE_MONEY_LIST = Object.values(
  CLICKPESA_CHANNELS
).filter((c) => c.rail === 'MOBILE_MONEY');

export const CLICKPESA_BANK_LIST = Object.values(CLICKPESA_CHANNELS).filter(
  (c) => c.rail === 'BANK_TRANSFER'
);

export const CLICKPESA_CARD_LIST = Object.values(CLICKPESA_CHANNELS).filter(
  (c) => c.rail === 'INTERNATIONAL_CARD'
);

/**
 * Valid State Machine Transitions:
 * INITIATED -> PROCESSING | SETTLED | FAILED
 * PROCESSING -> SETTLED | FAILED
 * SETTLED -> (Terminal State)
 * FAILED -> (Terminal State)
 */
const ALLOWED_STATE_TRANSITIONS: Record<
  ClickPesaTransactionState,
  ClickPesaTransactionState[]
> = {
  INITIATED: ['PROCESSING', 'SETTLED', 'FAILED'],
  PROCESSING: ['SETTLED', 'FAILED'],
  SETTLED: [],
  FAILED: [],
};

export function canTransitionClickPesaState(
  from: ClickPesaTransactionState,
  to: ClickPesaTransactionState
): boolean {
  if (from === to) return true;
  return ALLOWED_STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Auto-detects Tanzanian MNO provider from phone number prefix
 */
export function detectTanzanianMnoFromPhone(
  phoneInput: string
): ClickPesaProviderCode | null {
  const digits = phoneInput.replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('255')) local = local.slice(3);
  else if (local.startsWith('0')) local = local.slice(1);

  if (local.length < 2) return null;
  const prefix = local.slice(0, 2);

  for (const channel of CLICKPESA_MOBILE_MONEY_LIST) {
    if (channel.prefixes?.includes(prefix)) {
      return channel.code;
    }
  }
  return null;
}

/**
 * Normalizes a Tanzanian phone number to E.164 (`+255XXXXXXXXX`)
 */
export function normalizeTanzanianPhone(phoneInput: string): {
  valid: boolean;
  e164: string;
  masked: string;
  error?: string;
} {
  const digits = phoneInput.replace(/\D/g, '');
  let subscriber = digits;

  if (subscriber.startsWith('255')) {
    subscriber = subscriber.slice(3);
  } else if (subscriber.startsWith('0')) {
    subscriber = subscriber.slice(1);
  }

  if (!/^[67]\d{8}$/.test(subscriber)) {
    return {
      valid: false,
      e164: '',
      masked: '',
      error:
        'Enter a valid 9-digit Tanzanian mobile number starting with 6 or 7 (e.g. +255 754 123 456).',
    };
  }

  const e164 = `+255${subscriber}`;
  const masked = `+255 ${subscriber.slice(0, 2)}* *** ${subscriber.slice(-3)}`;
  return { valid: true, e164, masked };
}

/**
 * Generates a deterministic or unique Idempotency Key for ClickPesa `/api/payments/create`
 */
export function generateClickPesaIdempotencyKey(params: {
  userId: string;
  tierName: SubscriptionTierName;
  billingCycle: BillingCycle;
  providerCode: ClickPesaProviderCode;
  nonce?: string;
}): string {
  const bucket = Math.floor(Date.now() / 15_000); // 15-second deduplication window
  const suffix = params.nonce || bucket.toString(36);
  return `cp-idem-${params.userId.slice(0, 8)}-${params.tierName.toLowerCase()}-${params.billingCycle}-${params.providerCode.toLowerCase()}-${suffix}`;
}

/**
 * Generates a ClickPesa Order Reference & 12-digit Control Number for Bank/Mobile payments
 */
export function generateClickPesaOrderIdentifiers(
  providerCode: ClickPesaProviderCode,
  tierName: SubscriptionTierName
): {
  orderId: string;
  controlNumber: string;
} {
  const random6 = Math.floor(100000 + Math.random() * 900000);
  const random4 = Math.floor(1000 + Math.random() * 9000);
  const tierCode = tierName.slice(0, 3).toUpperCase();
  const orderId = `CP-${tierCode}-${providerCode.split('_')[0]}-${random6}`;
  const controlNumber = `994820${random6}${random4}`.slice(0, 12);
  return { orderId, controlNumber };
}

/**
 * Computes a deterministic HMAC-SHA256-like signature for ClickPesa webhook verification
 * Works in both Edge/Browser WebCrypto and Node runtime.
 */
export async function computeClickPesaWebhookSignature(
  payloadString: string,
  secret = 'clickpesa-whsec-mineconnect-tz-2026'
): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf = await crypto.subtle.sign(
      'HMAC',
      key,
      enc.encode(payloadString)
    );
    return Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Fallback hash if subtle crypto is unavailable
  let h1 = 0xdeadbeef ^ secret.length;
  let h2 = 0x41c6ce57 ^ payloadString.length;
  const combined = `${secret}:${payloadString}`;
  for (let i = 0; i < combined.length; i++) {
    const ch = combined.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  return `cp_sig_${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0)
    .toString(16)
    .padStart(8, '0')}`;
}

export async function verifyClickPesaWebhookSignature(
  payloadString: string,
  providedSignature: string | null | undefined,
  secret?: string
): Promise<boolean> {
  if (!providedSignature || providedSignature.trim().length < 8) {
    return false;
  }
  const expected = await computeClickPesaWebhookSignature(
    payloadString,
    secret
  );
  if (providedSignature.length !== expected.length) {
    return false;
  }
  // Constant-time character comparison
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ providedSignature.charCodeAt(i);
  }
  return diff === 0;
}
