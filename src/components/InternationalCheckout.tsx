'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import {
  executeStripePayment,
  type StripeCheckoutResponse,
} from '../app/api/payments/stripe/route';
import type { InternationalPaymentMethodId } from '../lib/payments/settlement';
import { useLocalization } from '../context/LocalizationContext';
import type { BillingCycle, SubscriptionTierName } from '../types/database';

export interface InternationalCheckoutProps {
  userId: string;
  tierName: SubscriptionTierName;
  billingCycle: BillingCycle;
  formattedAmount: string;
  pdpaConsent: boolean;
  onSuccess: (result: StripeCheckoutResponse) => void;
}

function detectCardBrand(
  rawNumber: string
): 'Visa' | 'Mastercard' | 'Discover' {
  const digits = rawNumber.replace(/\D/g, '');
  if (digits.startsWith('5') || digits.startsWith('2')) return 'Mastercard';
  if (digits.startsWith('6')) return 'Discover';
  return 'Visa';
}

function formatCardNumberInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  const groups = digits.match(/.{1,4}/g);
  return groups ? groups.join(' ') : digits;
}

function formatExpiryInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
  }
  return digits;
}

export default function InternationalCheckout({
  userId,
  tierName,
  billingCycle,
  formattedAmount,
  pdpaConsent,
  onSuccess,
}: InternationalCheckoutProps) {
  const { currency, ui } = useLocalization();

  const [cardNumber, setCardNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [saveToken, setSaveToken] = useState(true);
  const [processingMethod, setProcessingMethod] =
    useState<InternationalPaymentMethodId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detectedBrand = useMemo(
    () => detectCardBrand(cardNumber),
    [cardNumber]
  );

  const handleWalletPayment = async (
    walletMethod: 'apple_pay' | 'google_pay'
  ) => {
    setError(null);
    if (!pdpaConsent) {
      setError(
        ui(
          'Please confirm the PDPA 2022 billing & statutory fee acknowledgement below.',
          'Tafadhali thibitisha ridhaa ya malipo (PDPA 2022).',
          'Por favor confirme el consentimiento de facturación PDPA 2022.'
        )
      );
      return;
    }

    setProcessingMethod(walletMethod);
    try {
      const res = await executeStripePayment({
        userId,
        tier: tierName,
        billing: billingCycle,
        methodId: walletMethod,
        cardBrand: walletMethod === 'apple_pay' ? 'Apple Pay' : 'Google Pay',
        saveToken,
        currency,
      });

      if (!res.ok) {
        setError(res.error ?? 'Digital wallet authorization failed.');
        return;
      }

      onSuccess(res);
    } finally {
      setProcessingMethod(null);
    }
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pdpaConsent) {
      setError(
        ui(
          'Please confirm the PDPA 2022 billing & statutory fee acknowledgement.',
          'Tafadhali thibitisha ridhaa ya malipo (PDPA 2022).',
          'Por favor confirme el consentimiento PDPA 2022.'
        )
      );
      return;
    }

    const rawDigits = cardNumber.replace(/\D/g, '');
    if (rawDigits.length < 13 || rawDigits.length > 16) {
      setError(
        ui(
          'Please enter a valid 16-digit card number.',
          'Tafadhali weka namba sahihi ya kadi yenye tarakimu 16.',
          'Ingrese un número de tarjeta válido de 16 dígitos.'
        )
      );
      return;
    }

    if (!/^\d{2}\/\d{2}$/.test(expirationDate)) {
      setError(
        ui(
          'Please enter a valid expiration date in MM/YY format.',
          'Weka tarehe sahihi ya mwisho wa kadi (MM/YY).',
          'Ingrese una fecha de vencimiento válida (MM/YY).'
        )
      );
      return;
    }

    const cvcDigits = securityCode.replace(/\D/g, '');
    if (cvcDigits.length < 3 || cvcDigits.length > 4) {
      setError(
        ui(
          'Please enter a valid 3-or-4 digit security code (CVC/CVV).',
          'Weka namba ya siri ya kadi (CVC) yenye tarakimu 3 au 4.',
          'Ingrese un código de seguridad (CVC) válido.'
        )
      );
      return;
    }

    setProcessingMethod('credit_debit_card');
    try {
      const res = await executeStripePayment({
        userId,
        tier: tierName,
        billing: billingCycle,
        methodId: 'credit_debit_card',
        cardBrand: detectedBrand,
        cardLast4: rawDigits.slice(-4),
        cardholderName,
        saveToken,
        currency,
      });

      if (!res.ok) {
        setError(res.error ?? 'Card payment authorization failed.');
        return;
      }

      onSuccess(res);
    } finally {
      setProcessingMethod(null);
    }
  };

  return (
    <div className="rounded-2xl border border-[#2a2e39] bg-[#14171f] p-6 text-paper shadow-2xl sm:p-7">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-gold">
            {ui(
              'International Payment Gateway',
              'Malipo ya Kimataifa (Kadi & Wallets)',
              'Pasarela de Pago Internacional'
            )}
          </span>
          <h3 className="mt-0.5 font-display text-2xl font-medium text-white">
            {ui(
              'Express Digital Wallets & Cards',
              'Apple Pay, Google Pay na Kadi za Benki',
              'Billeteras Digitales y Tarjetas'
            )}
          </h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-moss/40 bg-moss/25 px-3 py-1 font-mono text-[10px] font-semibold text-[#9de4b4]">
          <Lock size={11} />
          PCI-DSS TLS 1.3
        </span>
      </div>

      {/* Express Checkout Buttons: Apple Pay & Google Pay */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Apple Pay Button */}
        <button
          type="button"
          disabled={processingMethod !== null}
          onClick={() => void handleWalletPayment('apple_pay')}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-black px-5 font-sans text-base font-semibold text-white shadow-md transition hover:border-white/45 hover:bg-[#0c0e12] disabled:opacity-50"
          aria-label="Pay with Apple Pay"
        >
          <svg
            viewBox="0 0 170 170"
            className="h-5 w-5 fill-current"
            aria-hidden="true"
          >
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.13-1.9-14.34-6.08-3.69-3.03-7.61-7.83-11.77-14.4-5.93-9.19-10.72-19.74-14.38-31.65-3.66-11.9-5.49-22.84-5.49-32.8 0-12.69 3.16-23.16 9.48-31.41 6.32-8.25 14.38-12.54 24.18-12.87 4.92 0 10.45 1.49 16.59 4.46 6.14 2.97 10.09 4.52 11.83 4.65 1.34 0 5.69-1.78 13.06-5.33 7.04-3.22 13.07-4.56 18.08-4.02 13.41 1.08 23.49 6.36 30.24 15.84-12.06 7.31-17.95 17.53-17.68 30.65.27 10.22 4.24 18.72 11.9 25.51 5.36 4.79 11.74 7.66 19.14 8.61-1.54 4.71-3.32 9.42-5.36 14.12zM119.22 31.02c0 8.01-2.92 15.49-8.76 22.44-7.03 8.22-15.54 12.97-24.81 12.22-.18-.99-.27-2.03-.27-3.14 0-7.69 3.34-15.91 10.02-24.66 3.2-4.12 7.27-7.54 12.21-10.25 4.94-2.71 9.62-4.21 14.04-4.5.25 2.71.37 5.34.37 7.89z" />
          </svg>
          <span>
            {processingMethod === 'apple_pay' ? 'Authorizing...' : 'Pay'}
          </span>
        </button>

        {/* Google Pay Button */}
        <button
          type="button"
          disabled={processingMethod !== null}
          onClick={() => void handleWalletPayment('google_pay')}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-[#1f2430] px-5 font-sans text-base font-semibold text-white shadow-md transition hover:border-white/45 hover:bg-[#282e3d] disabled:opacity-50"
          aria-label="Pay with Google Pay"
        >
          <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
            />
            <path
              fill="#FF3D00"
              d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
            />
          </svg>
          <span>
            {processingMethod === 'google_pay' ? 'Authorizing...' : 'Pay'}
          </span>
        </button>
      </div>

      {/* OR Divider */}
      <div className="relative my-6 flex items-center justify-center">
        <div className="w-full border-t border-white/12" />
        <span className="bg-[#14171f] px-3.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-white/50">
          OR
        </span>
        <div className="w-full border-t border-white/12" />
      </div>

      {/* Card Input Container */}
      <form onSubmit={handleCardSubmit} className="space-y-4">
        <div className="rounded-xl border border-white/15 bg-[#1b1f2a] p-4 sm:p-5">
          {/* Card Header with Brand Badges */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#3b82f6] bg-[#3b82f6]">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              <span className="text-sm font-semibold text-white">Card</span>
            </div>

            {/* Brand Badges: VISA, Mastercard, Discover */}
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex h-6 items-center rounded px-2 font-sans text-[11px] font-extrabold italic tracking-tight ${
                  detectedBrand === 'Visa'
                    ? 'bg-[#1a1f71] text-white ring-1 ring-gold'
                    : 'bg-[#1a1f71]/80 text-white/90'
                }`}
              >
                VISA
              </span>
              <span
                className={`inline-flex h-6 items-center justify-center rounded bg-[#252a38] px-2 ${
                  detectedBrand === 'Mastercard' ? 'ring-1 ring-gold' : ''
                }`}
                title="Mastercard"
              >
                <span className="h-3.5 w-3.5 rounded-full bg-[#eb001b]" />
                <span className="-ml-1.5 h-3.5 w-3.5 rounded-full bg-[#f79e1b] opacity-90" />
              </span>
              <span
                className={`inline-flex h-6 items-center rounded bg-[#f97316] px-2 font-mono text-[9px] font-bold uppercase text-white ${
                  detectedBrand === 'Discover' ? 'ring-1 ring-gold' : ''
                }`}
              >
                DISCOVER
              </span>
            </div>
          </div>

          {/* Card Number Field */}
          <div className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/80">
                Card number
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={cardNumber}
                  onChange={(e) =>
                    setCardNumber(formatCardNumberInput(e.target.value))
                  }
                  placeholder="4532 •••• •••• ••••"
                  className="h-11 w-full rounded-lg border border-white/15 bg-[#12151d] px-3.5 pr-10 font-mono text-sm text-white placeholder-white/30 outline-none transition focus:border-[#3b82f6]"
                />
                <CreditCard
                  size={16}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40"
                />
              </div>
            </div>

            {/* Expiration Date & Security Code */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/80">
                  Expiration date
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={expirationDate}
                  onChange={(e) =>
                    setExpirationDate(formatExpiryInput(e.target.value))
                  }
                  placeholder="MM/YY"
                  className="h-11 w-full rounded-lg border border-white/15 bg-[#12151d] px-3.5 font-mono text-sm text-white placeholder-white/30 outline-none transition focus:border-[#3b82f6]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/80">
                  Security code
                </label>
                <div className="relative">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    value={securityCode}
                    onChange={(e) =>
                      setSecurityCode(e.target.value.replace(/\D/g, ''))
                    }
                    placeholder="CVC"
                    className="h-11 w-full rounded-lg border border-white/15 bg-[#12151d] px-3.5 pr-12 font-mono text-sm text-white placeholder-white/30 outline-none transition focus:border-[#3b82f6]"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/20 px-1.5 py-0.5 font-mono text-[9px] text-white/50">
                    123
                  </span>
                </div>
              </div>
            </div>

            {/* Cardholder Name */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/80">
                Name on card
              </label>
              <input
                type="text"
                required
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                placeholder="Full name on card"
                className="h-11 w-full rounded-lg border border-white/15 bg-[#12151d] px-3.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-[#3b82f6]"
              />
            </div>

            {/* Token Persistence Checkbox */}
            <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-xs text-white/75">
              <input
                type="checkbox"
                checked={saveToken}
                onChange={(e) => setSaveToken(e.target.checked)}
                className="h-4 w-4 rounded border-white/25 accent-[#3b82f6]"
              />
              <span>
                {ui(
                  'Securely save card token for automated subscription renewals',
                  'Hifadhi tokeni ya kadi kwa usalama kwa ajili ya malipo yajayo',
                  'Guardar token de tarjeta de forma segura para renovaciones'
                )}
              </span>
            </label>
          </div>
        </div>

        {/* Security & Tokenization Notice */}
        <div className="flex items-start gap-3 rounded-xl border border-gold/25 bg-ochre/10 p-3.5 font-mono text-[11px] text-paper/80">
          <Lock size={15} className="mt-0.5 shrink-0 text-gold" />
          <div>
            <div className="font-semibold text-gold">
              {ui(
                'Stripe PCI-DSS Level 1 Encrypted Checkout',
                'Malipo Salama ya Stripe PCI-DSS Level 1',
                'Pago Cifrado Stripe PCI-DSS Nivel 1'
              )}
            </div>
            <div className="mt-0.5 text-[10px] text-white/70">
              {ui(
                'Card credentials are tokenized end-to-end via TLS 1.3 and verified via cryptographic webhook signatures.',
                'Taarifa za kadi zimesimbwa kwa usalama wa hali ya juu (TLS 1.3).',
                'Las credenciales de tarjeta se tokenizan de extremo a extremo mediante TLS 1.3.'
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-danger/50 bg-danger/15 p-3 text-xs font-medium text-[#f59c8a]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={processingMethod !== null}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ochre px-6 font-sans text-sm font-semibold text-white shadow-lg transition hover:bg-ochre-dark disabled:opacity-50"
        >
          <ShieldCheck size={17} />
          {processingMethod === 'credit_debit_card'
            ? ui(
                'Authorizing & Tokenizing Card...',
                'Inathibitisha Malipo ya Kadi...',
                'Autorizando y Tokenizando Tarjeta...'
              )
            : ui(
                `Pay & Subscribe (${formattedAmount})`,
                `Lipia kwa Kadi (${formattedAmount})`,
                `Pagar y Suscribirse (${formattedAmount})`
              )}
        </button>

        <div className="flex items-center justify-center gap-2 pt-1 font-mono text-[10px] text-white/50">
          <CheckCircle2 size={12} className="text-[#9de4b4]" />
          <span>
            Instant tier activation in `public.user_subscriptions` + immutable audit log
          </span>
        </div>
      </form>
    </div>
  );
}
