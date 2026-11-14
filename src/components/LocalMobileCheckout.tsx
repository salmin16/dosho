'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Phone,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import {
  executeMobileMoneyCharge,
  type MobileMoneyChargeResponse,
} from '../app/api/payments/mobile-money/route';
import type { MobileMoneyOperatorId } from '../lib/payments/settlement';
import { useLocalization } from '../context/LocalizationContext';
import type { BillingCycle, SubscriptionTierName } from '../types/database';

export interface LocalMobileCheckoutProps {
  userId: string;
  tierName: SubscriptionTierName;
  billingCycle: BillingCycle;
  formattedAmount: string;
  verifiedAmountTzs: number;
  pdpaConsent: boolean;
  onSwitchToCardRail: () => void;
  onSuccess: (result: MobileMoneyChargeResponse) => void;
}

interface OperatorOption {
  id: MobileMoneyOperatorId;
  label: string;
  subtitle: string;
  prefixHint: string;
  badgeBg: string;
  badgeText: string;
  badgeMark: string;
}

const TANZANIA_MOBILE_OPERATORS: OperatorOption[] = [
  {
    id: 'airtel_money',
    label: 'Airtel Money',
    subtitle: 'Airtel Tanzania Instant STK Push',
    prefixHint: '+255 68X / 78X XXX XXX',
    badgeBg: 'bg-[#e40000]',
    badgeText: 'text-white',
    badgeMark: 'airtel',
  },
  {
    id: 'mixx_by_yas',
    label: 'Mixx by Yas',
    subtitle: 'Formerly Tigo Pesa · Instant Wallet Debit',
    prefixHint: '+255 65X / 71X / 67X XXX XXX',
    badgeBg: 'bg-[#002868]',
    badgeText: 'text-[#ffd100]',
    badgeMark: 'Mixx',
  },
  {
    id: 'halopesa',
    label: 'Halopesa',
    subtitle: 'Halotel Tanzania Mobile Money',
    prefixHint: '+255 62X XXX XXX',
    badgeBg: 'bg-[#f37021]',
    badgeText: 'text-white',
    badgeMark: 'Halo',
  },
  {
    id: 'azampesa',
    label: 'Azampesa',
    subtitle: 'AzamPay Direct Digital Wallet',
    prefixHint: '+255 7XX XXX XXX',
    badgeBg: 'bg-[#004b93]',
    badgeText: 'text-white',
    badgeMark: 'AZAM',
  },
  {
    id: 'mpesa',
    label: 'M-Pesa',
    subtitle: 'Vodacom Tanzania M-Pesa Express',
    prefixHint: '+255 74X / 75X / 76X XXX XXX',
    badgeBg: 'bg-[#e60000]',
    badgeText: 'text-white',
    badgeMark: 'M-PESA',
  },
  {
    id: 'tpesa',
    label: 'T-Pesa',
    subtitle: 'TTCL Tanzania National Mobile Money',
    prefixHint: '+255 73X XXX XXX',
    badgeBg: 'bg-[#007a3d]',
    badgeText: 'text-[#fbbf24]',
    badgeMark: 'T-PESA',
  },
];

export default function LocalMobileCheckout({
  userId,
  tierName,
  billingCycle,
  formattedAmount,
  verifiedAmountTzs,
  pdpaConsent,
  onSwitchToCardRail,
  onSuccess,
}: LocalMobileCheckoutProps) {
  const { currency, ui } = useLocalization();

  const [selectedOperator, setSelectedOperator] =
    useState<OperatorOption>(TANZANIA_MOBILE_OPERATORS[4]); // Default M-Pesa
  const [mobileNumber, setMobileNumber] = useState('');
  const [pinOrPassword, setPinOrPassword] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    setProcessing(true);
    try {
      const res = await executeMobileMoneyCharge({
        userId,
        tier: tierName,
        billing: billingCycle,
        operatorId: selectedOperator.id,
        operatorLabel: selectedOperator.label,
        mobileNumber,
        pinOrPassword,
        currency,
      });

      if (!res.ok) {
        setError(res.error ?? 'Mobile money payment authorization failed.');
        return;
      }

      onSuccess(res);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-ink/15 bg-white p-6 text-ink shadow-xl sm:p-7">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-4">
        <div>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-ochre">
            {ui(
              'East Africa / Tanzania Mobile Money Gateway',
              'Malipo ya Simu za Mkononi (Tanzania)',
              'Pasarela de Dinero Móvil (Tanzania / África Oriental)'
            )}
          </span>
          <h3 className="mt-0.5 font-display text-2xl font-medium text-ink">
            {ui(
              'Select Mobile Payment Operator',
              'Chagua Mtandao wa Malipo ya Simu',
              'Seleccione Operador de Pago Móvil'
            )}
          </h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-moss/35 bg-moss-light px-3 py-1 font-mono text-[10px] font-semibold text-moss">
          <Smartphone size={12} />
          TSh {verifiedAmountTzs.toLocaleString('en-US')}
        </span>
      </div>

      {/* Operator Selection List matching reference design */}
      <div className="space-y-2.5" role="radiogroup" aria-label="Mobile Money Operators">
        {TANZANIA_MOBILE_OPERATORS.map((op) => {
          const isSelected = selectedOperator.id === op.id;
          return (
            <button
              key={op.id}
              type="button"
              onClick={() => {
                setSelectedOperator(op);
                setError(null);
              }}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                isSelected
                  ? 'border-ochre bg-ochre/[0.08] shadow-xs ring-1 ring-ochre'
                  : 'border-ink/12 bg-paper/45 hover:border-ochre/45 hover:bg-paper/80'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    isSelected
                      ? 'border-ochre bg-ochre'
                      : 'border-ink/30 bg-white'
                  }`}
                >
                  {isSelected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
                <div>
                  <div className="text-sm font-semibold text-ink">
                    {op.label}
                  </div>
                  <div className="text-[11px] text-stone">{op.subtitle}</div>
                </div>
              </div>

              {/* Brand Logo Pill */}
              <span
                className={`inline-flex h-8 min-w-[68px] items-center justify-center rounded-lg px-2.5 font-mono text-[11px] font-extrabold tracking-tight shadow-xs ${op.badgeBg} ${op.badgeText}`}
              >
                {op.badgeMark}
              </span>
            </button>
          );
        })}

        {/* Credit / Debit Card Switcher Row */}
        <button
          type="button"
          onClick={onSwitchToCardRail}
          className="flex w-full items-center justify-between rounded-xl border border-ink/12 bg-paper/45 px-4 py-3 text-left transition hover:border-ochre/45 hover:bg-paper/80"
        >
          <div className="flex items-center gap-3.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink/30 bg-white" />
            <div>
              <div className="text-sm font-semibold text-ink">
                Credit/Debit card
              </div>
              <div className="text-[11px] text-stone">
                Switch to Visa, Mastercard, Discover, Apple Pay or Google Pay
              </div>
            </div>
          </div>

          <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-ink/15 bg-white px-2.5 font-mono text-[10px] font-bold text-ink">
            <CreditCard size={13} className="text-ochre" />
            CARD
          </span>
        </button>
      </div>

      {/* Mobile Payment Number & PIN/Password Authorization Form */}
      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-xl border border-ink/15 bg-paper/75 p-5"
      >
        <div className="flex items-center justify-between border-b border-ink/10 pb-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex rounded px-2 py-0.5 font-mono text-[10px] font-bold ${selectedOperator.badgeBg} ${selectedOperator.badgeText}`}
            >
              {selectedOperator.badgeMark}
            </span>
            <span className="text-xs font-semibold text-ink">
              {selectedOperator.label}{' '}
              {ui(
                'Account Authorization',
                'Uthibitishaji wa Akaunti ya Simu',
                'Autorización de Cuenta Móvil'
              )}
            </span>
          </div>
          <span className="font-mono text-[10px] text-stone">
            STK Push / Direct Debit
          </span>
        </div>

        {/* 1. Mobile Payment Number */}
        <div>
          <label className="label flex items-center justify-between">
            <span>
              {ui(
                `${selectedOperator.label} Mobile Number`,
                `Namba ya Simu ya ${selectedOperator.label}`,
                `Número Móvil de ${selectedOperator.label}`
              )}
            </span>
            <span className="font-mono text-[10px] font-normal text-stone">
              {selectedOperator.prefixHint}
            </span>
          </label>
          <div className="relative">
            <Phone
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
            />
            <input
              type="tel"
              required
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="e.g. 0754 820 410 or +255 754 820 410"
              className="field !pl-10 font-mono"
            />
          </div>
        </div>

        {/* 2. Account PIN / Password Confirmation */}
        <div>
          <label className="label flex items-center justify-between">
            <span>
              {ui(
                `${selectedOperator.label} PIN / Password`,
                `Namba ya Siri (PIN) ya ${selectedOperator.label}`,
                `PIN / Contraseña de ${selectedOperator.label}`
              )}
            </span>
            <span className="font-mono text-[10px] font-normal text-moss">
              Encrypted End-to-End
            </span>
          </label>
          <div className="relative">
            <KeyRound
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone"
            />
            <input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              minLength={4}
              maxLength={12}
              required
              value={pinOrPassword}
              onChange={(e) => setPinOrPassword(e.target.value)}
              placeholder="•••• (Enter 4–6 digit PIN to authorize)"
              className="field !pl-10 !pr-10 font-mono tracking-widest"
            />
            <button
              type="button"
              onClick={() => setShowPin((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone hover:text-ink"
              aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
            >
              {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Encrypted STK Push & Aggregator Verification Box */}
        <div className="flex items-start gap-3 rounded-xl border border-ink/15 bg-ink p-3.5 font-mono text-[11px] text-paper">
          <Lock size={15} className="mt-0.5 shrink-0 text-gold" />
          <div>
            <div className="font-semibold text-gold">
              {ui(
                'East African Mobile Money Aggregator · Instant STK Push',
                'Mfumo Salama wa Malipo ya Simu · STK Push',
                'Pasarela Segura de Dinero Móvil · STK Push Instantáneo'
              )}
            </div>
            <div className="mt-0.5 text-[10px] text-paper/75">
              {ui(
                'Real-time collection via AzamPay / Flutterwave MNO rails with cryptographic webhook confirmation.',
                'Malipo yanathibitishwa moja kwa moja kwa usalama wa hali ya juu.',
                'Cobro en tiempo real con confirmación criptográfica de webhook.'
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs font-medium text-danger">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={processing}
          className="btn-primary w-full justify-center !py-3.5 text-sm"
        >
          <ShieldCheck size={17} />
          {processing
            ? ui(
                `Authorizing ${selectedOperator.label} STK Push...`,
                `Inathibitisha Malipo ya ${selectedOperator.label}...`,
                `Autorizando ${selectedOperator.label}...`
              )
            : ui(
                `Authorize ${selectedOperator.label} Payment (${formattedAmount})`,
                `Thibitisha Malipo ya ${selectedOperator.label} (${formattedAmount})`,
                `Autorizar Pago con ${selectedOperator.label} (${formattedAmount})`
              )}
        </button>

        <div className="flex items-center justify-center gap-2 pt-1 font-mono text-[10px] text-stone">
          <CheckCircle2 size={12} className="text-moss" />
          <span>
            {ui(
              'Instant subscription tier unlock upon mobile operator confirmation',
              'Mpango wako utawashwa mara moja baada ya uthibitisho wa malipo',
              'Activación instantánea del plan tras la confirmación del operador móvil'
            )}
          </span>
        </div>
      </form>
    </div>
  );
}
