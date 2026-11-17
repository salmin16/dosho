'use client';

import React from 'react';
import type { ClickPesaProviderCode, ClickPesaRail } from '../types/database';

export type PaymentMethod =
  | 'MPESA'
  | 'AIRTEL'
  | 'TIGO'
  | 'HALOPESA'
  | 'EZYPESA'
  | 'CRDB'
  | 'NMB'
  | 'NBC'
  | 'VISA'
  | 'MASTERCARD'
  | 'UNIONPAY';

export interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onSelect: (
    method: PaymentMethod,
    channel: 'MOBILE_MONEY' | 'BANK' | 'CARD'
  ) => void;
}

export interface PaymentProviderItem {
  id: PaymentMethod;
  providerCode: Exclude<ClickPesaProviderCode, 'FREE'>;
  rail: Exclude<ClickPesaRail, 'FREE'>;
  name: string;
  channel: 'MOBILE_MONEY' | 'BANK' | 'CARD';
  badgeColor: string;
  bgGlow: string;
  textColor: string;
  logoSvg: React.ReactNode;
  watermarkSvg: React.ReactNode;
  subtitle: string;
  ussdCode?: string;
}

export const PAYMENT_METHOD_TO_PROVIDER_CODE: Record<
  PaymentMethod,
  Exclude<ClickPesaProviderCode, 'FREE'>
> = {
  MPESA: 'MPESA_TZ',
  AIRTEL: 'AIRTEL_MONEY_TZ',
  TIGO: 'MIXX_BY_YAS',
  HALOPESA: 'HALOPESA_TZ',
  EZYPESA: 'EZYPESA_TZ',
  CRDB: 'CRDB_BANK',
  NMB: 'NMB_BANK',
  NBC: 'NBC_BANK',
  VISA: 'VISA_CARD',
  MASTERCARD: 'MASTERCARD',
  UNIONPAY: 'UNIONPAY_CARD',
};

export const PROVIDER_CODE_TO_PAYMENT_METHOD: Record<
  Exclude<ClickPesaProviderCode, 'FREE'>,
  PaymentMethod
> = {
  MPESA_TZ: 'MPESA',
  AIRTEL_MONEY_TZ: 'AIRTEL',
  MIXX_BY_YAS: 'TIGO',
  HALOPESA_TZ: 'HALOPESA',
  EZYPESA_TZ: 'EZYPESA',
  CRDB_BANK: 'CRDB',
  NMB_BANK: 'NMB',
  NBC_BANK: 'NBC',
  VISA_CARD: 'VISA',
  MASTERCARD: 'MASTERCARD',
  UNIONPAY_CARD: 'UNIONPAY',
};

// Official brand vector logos and corporate color identifiers
export const PAYMENT_PROVIDERS: PaymentProviderItem[] = [
  // Mobile Money (Tanzania)
  {
    id: 'MPESA',
    providerCode: 'MPESA_TZ',
    rail: 'MOBILE_MONEY',
    name: 'M-Pesa',
    channel: 'MOBILE_MONEY',
    badgeColor: 'bg-[#e60000]', // Official Vodacom Red
    bgGlow: 'from-[#e60000]/25 via-slate-900/90 to-slate-950',
    textColor: 'text-white',
    logoSvg: (
      <svg viewBox="0 0 48 48" className="h-7 w-7">
        <circle cx="24" cy="24" r="20" fill="#ffffff" />
        <path
          d="M24 9C16.5 9 11.5 15 11.5 22.8C11.5 30.5 17.2 37 25 37C30.2 37 34 33.8 35.2 29.2C32 31 27.8 30.6 25.4 27.8C22.6 24.5 23.2 18 28.8 12.5C27.4 10.2 25.8 9 24 9Z"
          fill="#e60000"
        />
        <rect
          x="18"
          y="33"
          width="24"
          height="9"
          rx="4.5"
          fill="#00a651"
          stroke="#ffffff"
          strokeWidth="1.5"
        />
        <text
          x="30"
          y="39.5"
          textAnchor="middle"
          fontSize="5.5"
          fontWeight="900"
          fill="#ffffff"
        >
          M-PESA
        </text>
      </svg>
    ),
    watermarkSvg: (
      <svg viewBox="0 0 120 48" className="h-16 w-36">
        <circle cx="24" cy="24" r="18" fill="#e60000" />
        <path
          d="M24 10C17.5 10 13 15.5 13 22.5C13 29.5 18 35 25 35C29.5 35 33 32 34 28C31 29.5 27.5 29 25.2 26.5C22.8 23.5 23.5 18 28 13C26.8 11 25.5 10 24 10Z"
          fill="#ffffff"
        />
        <text
          x="48"
          y="30"
          fontSize="16"
          fontWeight="900"
          fill="#ffffff"
          fontFamily="Arial, sans-serif"
        >
          M-PESA
        </text>
      </svg>
    ),
    subtitle: 'Vodacom Tanzania · *150*00#',
    ussdCode: '*150*00#',
  },
  {
    id: 'AIRTEL',
    providerCode: 'AIRTEL_MONEY_TZ',
    rail: 'MOBILE_MONEY',
    name: 'Airtel Money',
    channel: 'MOBILE_MONEY',
    badgeColor: 'bg-[#ff0000]', // Official Airtel Red
    bgGlow: 'from-[#ff0000]/25 via-slate-900/90 to-slate-950',
    textColor: 'text-white',
    logoSvg: (
      <svg viewBox="0 0 48 48" className="h-7 w-7">
        <path
          d="M13 33C10 27 12.5 15 22.5 11C31.5 7.5 38 12.5 37 21.5C36 29 28 35.5 21 34.5C17.5 34 16.5 30 19 26.5C21.2 23.5 26.5 22.5 30 24.5"
          stroke="#ffffff"
          strokeWidth="4.5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="32.5" cy="33.5" r="3.2" fill="#ffffff" />
      </svg>
    ),
    watermarkSvg: (
      <svg viewBox="0 0 120 48" className="h-16 w-36">
        <path
          d="M12 34C9 28 11.5 16 21.5 12C30.5 8.5 37 13.5 36 22.5C35 30 27 36.5 20 35.5C16.5 35 15.5 31 18 27.5C20.2 24.5 25.5 23.5 29 25.5"
          stroke="#ff0000"
          strokeWidth="4.5"
          strokeLinecap="round"
          fill="none"
        />
        <text
          x="44"
          y="30"
          fontSize="18"
          fontWeight="900"
          fill="#ffffff"
          fontFamily="Arial, sans-serif"
        >
          airtel
        </text>
      </svg>
    ),
    subtitle: 'Airtel Tanzania · *150*60#',
    ussdCode: '*150*60#',
  },
  {
    id: 'TIGO',
    providerCode: 'MIXX_BY_YAS',
    rail: 'MOBILE_MONEY',
    name: 'Mixx by Yas / Tigo Pesa',
    channel: 'MOBILE_MONEY',
    badgeColor: 'bg-[#00377b]', // Official Mixx by Yas / Tigo Blue
    bgGlow: 'from-[#00a3e0]/25 via-slate-900/90 to-slate-950',
    textColor: 'text-white',
    logoSvg: (
      <svg viewBox="0 0 48 48" className="h-7 w-7">
        <rect x="4" y="8" width="40" height="32" rx="7" fill="#00377b" />
        <path d="M30 8H37C40.8 8 44 11.2 44 15V40H24L30 8Z" fill="#ffd100" />
        <text
          x="18"
          y="29"
          textAnchor="middle"
          fontSize="13"
          fontWeight="900"
          fontStyle="italic"
          fill="#ffd100"
        >
          Mixx
        </text>
      </svg>
    ),
    watermarkSvg: (
      <svg viewBox="0 0 120 48" className="h-16 w-36">
        <text
          x="10"
          y="32"
          fontSize="24"
          fontWeight="900"
          fontStyle="italic"
          fill="#ffd100"
          fontFamily="Arial, sans-serif"
        >
          Mixx
        </text>
        <text
          x="74"
          y="32"
          fontSize="20"
          fontWeight="900"
          fill="#00a3e0"
          fontFamily="Arial, sans-serif"
        >
          yas
        </text>
      </svg>
    ),
    subtitle: 'Tigo / Mixx by Yas · *150*01#',
    ussdCode: '*150*01#',
  },
  {
    id: 'HALOPESA',
    providerCode: 'HALOPESA_TZ',
    rail: 'MOBILE_MONEY',
    name: 'HaloPesa',
    channel: 'MOBILE_MONEY',
    badgeColor: 'bg-[#ff6600]', // Official Halotel Orange
    bgGlow: 'from-[#ff6600]/25 via-slate-900/90 to-slate-950',
    textColor: 'text-white',
    logoSvg: (
      <svg viewBox="0 0 48 48" className="h-7 w-7">
        <circle cx="24" cy="24" r="16" fill="#ffffff" />
        <path
          d="M15 24C15 16 24 12 24 24C24 36 33 32 33 24"
          stroke="#ff6600"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="24" cy="24" r="3.5" fill="#0054a6" />
      </svg>
    ),
    watermarkSvg: (
      <svg viewBox="0 0 120 48" className="h-16 w-36">
        <circle cx="22" cy="24" r="14" fill="#ff6600" />
        <text
          x="42"
          y="30"
          fontSize="16"
          fontWeight="900"
          fill="#ffffff"
          fontFamily="Arial, sans-serif"
        >
          HaloPesa
        </text>
      </svg>
    ),
    subtitle: 'Halotel Tanzania · *150*88#',
    ussdCode: '*150*88#',
  },
  {
    id: 'EZYPESA',
    providerCode: 'EZYPESA_TZ',
    rail: 'MOBILE_MONEY',
    name: 'EzyPesa',
    channel: 'MOBILE_MONEY',
    badgeColor: 'bg-[#6b21a8]', // Deep Purple / Zantel Corporate
    bgGlow: 'from-[#6b21a8]/30 via-slate-900/90 to-slate-950',
    textColor: 'text-white',
    logoSvg: (
      <svg viewBox="0 0 48 48" className="h-7 w-7">
        <circle cx="24" cy="24" r="16" fill="#8cc63f" />
        <path
          d="M17 18H31L17 30H31"
          stroke="#ffffff"
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    ),
    watermarkSvg: (
      <svg viewBox="0 0 120 48" className="h-16 w-36">
        <circle cx="22" cy="24" r="14" fill="#8cc63f" />
        <text
          x="42"
          y="30"
          fontSize="16"
          fontWeight="900"
          fill="#ffffff"
          fontFamily="Arial, sans-serif"
        >
          EzyPesa
        </text>
      </svg>
    ),
    subtitle: 'Zantel / Exim · *150*02#',
    ussdCode: '*150*02#',
  },

  // Banks (Tanzania)
  {
    id: 'CRDB',
    providerCode: 'CRDB_BANK',
    rail: 'BANK_TRANSFER',
    name: 'CRDB Bank',
    channel: 'BANK',
    badgeColor: 'bg-[#008751]', // Official CRDB Green
    bgGlow: 'from-[#008751]/30 via-slate-900/90 to-slate-950',
    textColor: 'text-white',
    logoSvg: (
      <svg viewBox="0 0 48 48" className="h-7 w-7">
        <path d="M24 6L42 24L24 42L6 24L24 6Z" fill="#ffffff" />
        <path d="M24 12L36 24L24 36L12 24L24 12Z" fill="#008751" />
        <circle cx="24" cy="24" r="5" fill="#8dc63f" />
      </svg>
    ),
    watermarkSvg: (
      <svg viewBox="0 0 120 48" className="h-16 w-36">
        <path d="M22 6L38 24L22 42L6 24L22 6Z" fill="#008751" />
        <text
          x="44"
          y="31"
          fontSize="20"
          fontWeight="900"
          fill="#ffffff"
          fontFamily="Arial, sans-serif"
        >
          CRDB
        </text>
      </svg>
    ),
    subtitle: 'The Bank That Listens · SimBanking',
    ussdCode: '*150*03#',
  },
  {
    id: 'NMB',
    providerCode: 'NMB_BANK',
    rail: 'BANK_TRANSFER',
    name: 'NMB Bank',
    channel: 'BANK',
    badgeColor: 'bg-[#003366]', // Official NMB Blue
    bgGlow: 'from-[#004b87]/35 via-slate-900/90 to-slate-950',
    textColor: 'text-white',
    logoSvg: (
      <svg viewBox="0 0 48 48" className="h-7 w-7">
        <path
          d="M8 36C14 16 28 12 42 18C28 19 16 24 8 36Z"
          fill="#f37021"
        />
        <circle cx="16" cy="15" r="4" fill="#fdb913" />
        <text
          x="26"
          y="35"
          textAnchor="middle"
          fontSize="13"
          fontWeight="900"
          fill="#ffffff"
        >
          NMB
        </text>
      </svg>
    ),
    watermarkSvg: (
      <svg viewBox="0 0 120 48" className="h-16 w-36">
        <path
          d="M10 38C20 14 50 10 110 18C76 18 34 24 10 38Z"
          fill="#f37021"
        />
        <text
          x="44"
          y="34"
          fontSize="22"
          fontWeight="900"
          fill="#ffffff"
          fontFamily="Arial, sans-serif"
        >
          NMB
        </text>
      </svg>
    ),
    subtitle: 'Karibu Yako · NMB Mkononi',
    ussdCode: '*150*66#',
  },
  {
    id: 'NBC',
    providerCode: 'NBC_BANK',
    rail: 'BANK_TRANSFER',
    name: 'NBC Bank',
    channel: 'BANK',
    badgeColor: 'bg-[#002b49]', // Official NBC Navy
    bgGlow: 'from-[#e31837]/25 via-slate-900/90 to-slate-950',
    textColor: 'text-white',
    logoSvg: (
      <svg viewBox="0 0 48 48" className="h-7 w-7">
        <circle cx="24" cy="24" r="16" fill="#e31837" />
        <path d="M14 28L24 13L34 28L24 23L14 28Z" fill="#ffffff" />
      </svg>
    ),
    watermarkSvg: (
      <svg viewBox="0 0 120 48" className="h-16 w-36">
        <circle cx="22" cy="24" r="14" fill="#e31837" />
        <text
          x="44"
          y="32"
          fontSize="22"
          fontWeight="900"
          fill="#ffffff"
          fontFamily="Arial, sans-serif"
        >
          NBC
        </text>
      </svg>
    ),
    subtitle: 'National Bank of Commerce',
    ussdCode: '*150*55#',
  },

  // Cards
  {
    id: 'VISA',
    providerCode: 'VISA_CARD',
    rail: 'INTERNATIONAL_CARD',
    name: 'Visa',
    channel: 'CARD',
    badgeColor: 'bg-[#1a1f71]', // Official Visa Blue
    bgGlow: 'from-[#1a1f71]/40 via-slate-900/90 to-slate-950',
    textColor: 'text-white',
    logoSvg: (
      <svg viewBox="0 0 48 48" className="h-7 w-7">
        <text
          x="24"
          y="30"
          textAnchor="middle"
          fontSize="16"
          fontWeight="900"
          fontStyle="italic"
          fill="#ffffff"
        >
          VISA
        </text>
        <rect x="6" y="36" width="36" height="4" rx="2" fill="#f7b600" />
      </svg>
    ),
    watermarkSvg: (
      <svg viewBox="0 0 120 48" className="h-16 w-36">
        <text
          x="60"
          y="34"
          textAnchor="middle"
          fontSize="28"
          fontWeight="900"
          fontStyle="italic"
          fill="#f7b600"
          fontFamily="Arial, sans-serif"
        >
          VISA
        </text>
      </svg>
    ),
    subtitle: 'Global Credit / Debit · 3DS 2.0',
  },
  {
    id: 'MASTERCARD',
    providerCode: 'MASTERCARD',
    rail: 'INTERNATIONAL_CARD',
    name: 'Mastercard',
    channel: 'CARD',
    badgeColor: 'bg-[#111827]', // Dark charcoal backdrop for MC circles
    bgGlow: 'from-[#eb001b]/25 via-slate-900/90 to-slate-950',
    textColor: 'text-white',
    logoSvg: (
      <svg viewBox="0 0 24 24" className="h-7 w-7">
        <circle cx="9" cy="12" r="7" fill="#eb001b" />
        <circle cx="15" cy="12" r="7" fill="#f79e1b" fillOpacity="0.88" />
      </svg>
    ),
    watermarkSvg: (
      <svg viewBox="0 0 120 48" className="h-16 w-36">
        <circle cx="48" cy="24" r="16" fill="#eb001b" />
        <circle cx="72" cy="24" r="16" fill="#f79e1b" fillOpacity="0.88" />
      </svg>
    ),
    subtitle: 'Mastercard Identity Check',
  },
  {
    id: 'UNIONPAY',
    providerCode: 'UNIONPAY_CARD',
    rail: 'INTERNATIONAL_CARD',
    name: 'UnionPay',
    channel: 'CARD',
    badgeColor: 'bg-[#00447c]',
    bgGlow: 'from-[#007b84]/30 via-slate-900/90 to-slate-950',
    textColor: 'text-white',
    logoSvg: (
      <svg viewBox="0 0 48 48" className="h-7 w-7">
        <polygon points="6,10 18,10 14,38 2,38" fill="#e21836" />
        <polygon points="16,10 32,10 28,38 12,38" fill="#00447c" />
        <polygon points="30,10 46,10 42,38 26,38" fill="#007b84" />
      </svg>
    ),
    watermarkSvg: (
      <svg viewBox="0 0 120 48" className="h-16 w-36">
        <polygon points="18,6 46,6 38,42 10,42" fill="#e21836" />
        <polygon points="42,6 76,6 68,42 34,42" fill="#00447c" />
        <polygon points="72,6 108,6 100,42 64,42" fill="#007b84" />
      </svg>
    ),
    subtitle: 'UnionPay International',
  },
];

export function PaymentMethodSelector({
  selectedMethod,
  onSelect,
}: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100 shadow-2xl sm:p-6">
      {/* Mobile Money Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-400">
            1. Tanzania Mobile Money (Instant USSD STK Push)
          </h3>
          <span className="font-mono text-[10px] text-slate-400">
            Vodacom · Airtel · Yas/Tigo · Halotel · Zantel
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PAYMENT_PROVIDERS.filter((p) => p.channel === 'MOBILE_MONEY').map(
            (provider) => {
              const isSelected = selectedMethod === provider.id;
              return (
                <div
                  key={provider.id}
                  onClick={() => onSelect(provider.id, provider.channel)}
                  className={`group relative flex cursor-pointer items-center overflow-hidden rounded-xl border bg-gradient-to-br ${provider.bgGlow} p-3.5 transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-slate-900 ring-2 ring-amber-500/35 shadow-lg'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  {/* Official Network Logo Watermark in Background */}
                  <div
                    className={`pointer-events-none absolute -bottom-2 -right-2 transition-transform duration-300 group-hover:scale-105 ${
                      isSelected ? 'opacity-25' : 'opacity-[0.12]'
                    }`}
                    aria-hidden="true"
                  >
                    {provider.watermarkSvg}
                  </div>

                  <div
                    className={`relative z-10 mr-3.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${provider.badgeColor} ${provider.textColor} shadow-md ring-1 ring-white/15`}
                  >
                    {provider.logoSvg}
                  </div>
                  <div className="relative z-10 min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {provider.name}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {provider.subtitle}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="relative z-10 ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-950 shadow">
                      ✓
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Banks Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-400">
            2. Partner Commercial Banks (Control Number &amp; Direct Transfer)
          </h3>
          <span className="font-mono text-[10px] text-slate-400">
            CRDB · NMB · NBC
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PAYMENT_PROVIDERS.filter((p) => p.channel === 'BANK').map(
            (provider) => {
              const isSelected = selectedMethod === provider.id;
              return (
                <div
                  key={provider.id}
                  onClick={() => onSelect(provider.id, provider.channel)}
                  className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-gradient-to-br ${provider.bgGlow} p-4 transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-slate-900 ring-2 ring-amber-500/35 shadow-lg'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  {/* Official Bank Logo Watermark in Background */}
                  <div
                    className={`pointer-events-none absolute -bottom-2 -right-2 transition-transform duration-300 group-hover:scale-105 ${
                      isSelected ? 'opacity-25' : 'opacity-[0.12]'
                    }`}
                    aria-hidden="true"
                  >
                    {provider.watermarkSvg}
                  </div>

                  <div className="relative z-10 mb-2.5 flex items-center justify-between">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${provider.badgeColor} ${provider.textColor} shadow ring-1 ring-white/15`}
                    >
                      {provider.logoSvg}
                    </div>
                    {isSelected ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-950 shadow">
                        ✓
                      </div>
                    ) : (
                      <span className="rounded bg-slate-800/80 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                        {provider.ussdCode}
                      </span>
                    )}
                  </div>
                  <p className="relative z-10 text-sm font-semibold text-slate-100">
                    {provider.name}
                  </p>
                  <p className="relative z-10 mt-0.5 truncate text-[11px] text-slate-400">
                    {provider.subtitle}
                  </p>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* International Cards Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-400">
            3. International &amp; Local Cards (3D Secure 2.0)
          </h3>
          <span className="font-mono text-[10px] text-slate-400">
            Visa · Mastercard · UnionPay
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PAYMENT_PROVIDERS.filter((p) => p.channel === 'CARD').map(
            (provider) => {
              const isSelected = selectedMethod === provider.id;
              return (
                <div
                  key={provider.id}
                  onClick={() => onSelect(provider.id, provider.channel)}
                  className={`group relative flex cursor-pointer items-center overflow-hidden rounded-xl border bg-gradient-to-br ${provider.bgGlow} p-3.5 transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-slate-900 ring-2 ring-amber-500/35 shadow-lg'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  {/* Official Card Logo Watermark in Background */}
                  <div
                    className={`pointer-events-none absolute -bottom-2 -right-2 transition-transform duration-300 group-hover:scale-105 ${
                      isSelected ? 'opacity-25' : 'opacity-[0.12]'
                    }`}
                    aria-hidden="true"
                  >
                    {provider.watermarkSvg}
                  </div>

                  <div
                    className={`relative z-10 mr-3.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${provider.badgeColor} ${provider.textColor} shadow-md ring-1 ring-white/15`}
                  >
                    {provider.logoSvg}
                  </div>
                  <div className="relative z-10 min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {provider.name}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {provider.subtitle}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="relative z-10 ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-slate-950 shadow">
                      ✓
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>
      </div>
    </div>
  );
}

export default PaymentMethodSelector;
