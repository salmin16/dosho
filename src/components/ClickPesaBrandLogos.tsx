'use client';

import type { ClickPesaProviderCode } from '../types/database';

export interface ProviderBrandTheme {
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  cardBgGradient: string;
  selectedBgGradient: string;
  borderHex: string;
  tagline: string;
  officialEntity: string;
}

export const PROVIDER_BRAND_THEMES: Record<
  Exclude<ClickPesaProviderCode, 'FREE'>,
  ProviderBrandTheme
> = {
  MPESA_TZ: {
    primaryHex: '#E60000',
    secondaryHex: '#00A651',
    accentHex: '#FFFFFF',
    cardBgGradient:
      'linear-gradient(135deg, #fff5f5 0%, #ffffff 55%, #f0fdf4 100%)',
    selectedBgGradient:
      'linear-gradient(135deg, #990000 0%, #d60000 55%, #b30000 100%)',
    borderHex: '#E60000',
    tagline: 'Vodacom Tanzania PLC · Lipa Kwa M-Pesa',
    officialEntity: 'Vodacom M-Pesa',
  },
  AIRTEL_MONEY_TZ: {
    primaryHex: '#E40000',
    secondaryHex: '#990000',
    accentHex: '#FFFFFF',
    cardBgGradient:
      'linear-gradient(135deg, #fff3f3 0%, #ffffff 60%, #ffe6e6 100%)',
    selectedBgGradient:
      'linear-gradient(135deg, #8b0000 0%, #e40000 65%, #b80000 100%)',
    borderHex: '#E40000',
    tagline: 'Airtel Money Tanzania · Instant STK Push',
    officialEntity: 'Airtel Money',
  },
  MIXX_BY_YAS: {
    primaryHex: '#00377B',
    secondaryHex: '#FFD100',
    accentHex: '#00A8E8',
    cardBgGradient:
      'linear-gradient(135deg, #f0f6ff 0%, #ffffff 55%, #fffbeb 100%)',
    selectedBgGradient:
      'linear-gradient(135deg, #001f4d 0%, #00377b 60%, #004ea8 100%)',
    borderHex: '#00377B',
    tagline: 'Yas Tanzania (Formerly Tigo Pesa) · Mixx by Yas',
    officialEntity: 'Mixx by Yas',
  },
  HALOPESA_TZ: {
    primaryHex: '#F37021',
    secondaryHex: '#0054A6',
    accentHex: '#FFB703',
    cardBgGradient:
      'linear-gradient(135deg, #fff7ed 0%, #ffffff 55%, #eff6ff 100%)',
    selectedBgGradient:
      'linear-gradient(135deg, #c2410c 0%, #f37021 60%, #0054a6 100%)',
    borderHex: '#F37021',
    tagline: 'Viettel / Halotel Tanzania · HaloPesa USSD',
    officialEntity: 'HaloPesa',
  },
  EZYPESA_TZ: {
    primaryHex: '#009639',
    secondaryHex: '#006837',
    accentHex: '#8CC63F',
    cardBgGradient:
      'linear-gradient(135deg, #f0fdf4 0%, #ffffff 60%, #dcfce7 100%)',
    selectedBgGradient:
      'linear-gradient(135deg, #064e3b 0%, #009639 65%, #047857 100%)',
    borderHex: '#009639',
    tagline: 'Zantel Zanzibar & Mainland · EzyPesa Direct',
    officialEntity: 'EzyPesa',
  },
  CRDB_BANK: {
    primaryHex: '#007A33',
    secondaryHex: '#004D20',
    accentHex: '#8DC63F',
    cardBgGradient:
      'linear-gradient(135deg, #ecfdf5 0%, #ffffff 55%, #dcfce7 100%)',
    selectedBgGradient:
      'linear-gradient(135deg, #003d19 0%, #007a33 60%, #005c26 100%)',
    borderHex: '#007A33',
    tagline: 'CRDB Bank PLC · SimBanking & FahariHuduma',
    officialEntity: 'CRDB Bank PLC',
  },
  NMB_BANK: {
    primaryHex: '#004B87',
    secondaryHex: '#F37021',
    accentHex: '#FDB913',
    cardBgGradient:
      'linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #fff7ed 100%)',
    selectedBgGradient:
      'linear-gradient(135deg, #002b52 0%, #004b87 60%, #0062ad 100%)',
    borderHex: '#004B87',
    tagline: 'NMB Bank PLC · NMB Mkononi & NMB Direct',
    officialEntity: 'NMB Bank PLC',
  },
  NBC_BANK: {
    primaryHex: '#1A2B6D',
    secondaryHex: '#E31837',
    accentHex: '#FFFFFF',
    cardBgGradient:
      'linear-gradient(135deg, #eef2ff 0%, #ffffff 55%, #fff1f2 100%)',
    selectedBgGradient:
      'linear-gradient(135deg, #0f172a 0%, #1a2b6d 60%, #283c8f 100%)',
    borderHex: '#1A2B6D',
    tagline: 'National Bank of Commerce · NBC Kiganjani',
    officialEntity: 'NBC Bank Tanzania',
  },
  VISA_CARD: {
    primaryHex: '#1A1F71',
    secondaryHex: '#F7B600',
    accentHex: '#FFFFFF',
    cardBgGradient:
      'linear-gradient(135deg, #eef2ff 0%, #ffffff 55%, #fefce8 100%)',
    selectedBgGradient:
      'linear-gradient(135deg, #0f1347 0%, #1a1f71 65%, #252d9c 100%)',
    borderHex: '#1A1F71',
    tagline: 'Visa International · Verified by Visa 3DS 2.0',
    officialEntity: 'Visa Worldwide',
  },
  MASTERCARD: {
    primaryHex: '#EB001B',
    secondaryHex: '#F79E1B',
    accentHex: '#FF5F00',
    cardBgGradient:
      'linear-gradient(135deg, #fff1f2 0%, #ffffff 50%, #fffbeb 100%)',
    selectedBgGradient:
      'linear-gradient(135deg, #18181b 0%, #27272a 55%, #3f3f46 100%)',
    borderHex: '#EB001B',
    tagline: 'Mastercard Identity Check · Global 3DS 2.0',
    officialEntity: 'Mastercard International',
  },
  UNIONPAY_CARD: {
    primaryHex: '#00447C',
    secondaryHex: '#E21836',
    accentHex: '#007B84',
    cardBgGradient:
      'linear-gradient(135deg, #f0f9ff 0%, #ffffff 55%, #f0fdfa 100%)',
    selectedBgGradient:
      'linear-gradient(135deg, #002c52 0%, #00447c 55%, #007b84 100%)',
    borderHex: '#007B84',
    tagline: 'UnionPay International · Commercial & Personal',
    officialEntity: 'UnionPay International',
  },
};

export function ClickPesaBrandMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      aria-label="ClickPesa FinTech Gateway"
    >
      <rect width="40" height="40" rx="10" fill="#0B132B" />
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="8.5"
        stroke="#D6A443"
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
      <path
        d="M23 7L11 22H19.5L17 33L29 18H20.5L23 7Z"
        fill="#D6A443"
        stroke="#F6F1E7"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Renders the authentic brand SVG logo for each Tanzanian MNO, Bank, or Card network.
 * Supports `badge` (crisp full-color emblem) and `watermark` (large background silhouette).
 */
export function ClickPesaProviderLogo({
  code,
  variant = 'badge',
  className = '',
}: {
  code: Exclude<ClickPesaProviderCode, 'FREE'>;
  variant?: 'badge' | 'watermark' | 'banner';
  className?: string;
}) {
  const isWatermark = variant === 'watermark';
  const sizeClass =
    className ||
    (isWatermark
      ? 'h-24 w-36 opacity-[0.14]'
      : variant === 'banner'
        ? 'h-11 w-24'
        : 'h-9 w-16');

  switch (code) {
    case 'MPESA_TZ':
      return (
        <svg
          viewBox="0 0 120 56"
          className={sizeClass}
          aria-label="Vodacom M-Pesa official logo"
        >
          {/* Red Vodacom / M-Pesa base pill */}
          <rect width="120" height="56" rx="10" fill="#E60000" />
          {/*Vodacom speech/teardrop mark */}
          <circle cx="24" cy="28" r="14" fill="#FFFFFF" />
          <path
            d="M24 17C18.5 17 15 21.5 15 27C15 32.5 19.2 37 24.8 37C28.5 37 31.2 34.8 32 31.5C29.8 32.8 26.8 32.5 25 30.5C23 28.2 23.5 23.5 27.5 19.5C26.5 17.8 25.3 17 24 17Z"
            fill="#E60000"
          />
          {/* M-PESA green mobile device & wave */}
          <rect
            x="44"
            y="12"
            width="13"
            height="22"
            rx="2.5"
            fill="#FFFFFF"
            stroke="#00A651"
            strokeWidth="2"
          />
          <path
            d="M42 25C48 19 54 19 60 25"
            stroke="#00A651"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          {/* M-PESA Wordmark */}
          <text
            x="62"
            y="27"
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontSize="13.5"
            letterSpacing="0.5"
          >
            M-PESA
          </text>
          <rect x="44" y="38" width="66" height="8" rx="4" fill="#00A651" />
          <text
            x="77"
            y="44.5"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
            fontWeight="800"
            fontSize="6.5"
            letterSpacing="1.2"
          >
            VODACOM TZ
          </text>
        </svg>
      );

    case 'AIRTEL_MONEY_TZ':
      return (
        <svg
          viewBox="0 0 120 56"
          className={sizeClass}
          aria-label="Airtel Money official logo"
        >
          <rect width="120" height="56" rx="10" fill="#E40000" />
          {/* Signature Airtel curved 'a' wave */}
          <path
            d="M17 36C14 31 16 20 25 16C33 12.5 39 17 38 25C37 32 30 38 24 37C21 36.5 20 33 22 30C24 27 29 26 32 28"
            stroke="#FFFFFF"
            strokeWidth="4.2"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="34" cy="36" r="2.8" fill="#FFFFFF" />
          <text
            x="46"
            y="27"
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontSize="16"
            letterSpacing="0.2"
          >
            airtel
          </text>
          <rect
            x="46"
            y="33"
            width="58"
            height="12"
            rx="3"
            fill="#FFFFFF"
          />
          <text
            x="75"
            y="41.5"
            textAnchor="middle"
            fill="#E40000"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontSize="8.5"
            letterSpacing="1.4"
          >
            MONEY
          </text>
        </svg>
      );

    case 'MIXX_BY_YAS':
      return (
        <svg
          viewBox="0 0 120 56"
          className={sizeClass}
          aria-label="Mixx by Yas (Tigo Pesa) official logo"
        >
          <rect width="120" height="56" rx="10" fill="#00377B" />
          {/* Vibrant Yellow-Gold accent corner */}
          <path d="M88 0H110C115.5 0 120 4.5 120 10V56H72L88 0Z" fill="#FFD100" />
          <text
            x="12"
            y="29"
            fill="#FFD100"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontSize="20"
            fontStyle="italic"
          >
            Mixx
          </text>
          <text
            x="12"
            y="43"
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
            fontWeight="700"
            fontSize="8.5"
            letterSpacing="0.8"
          >
            TIGO PESA
          </text>
          <text
            x="97"
            y="33"
            textAnchor="middle"
            fill="#00377B"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontSize="15"
          >
            yas
          </text>
        </svg>
      );

    case 'HALOPESA_TZ':
      return (
        <svg
          viewBox="0 0 120 56"
          className={sizeClass}
          aria-label="HaloPesa official logo"
        >
          <rect width="120" height="56" rx="10" fill="#F37021" />
          <path
            d="M0 38L120 26V46C120 51.5 115.5 56 110 56H10C4.5 56 0 51.5 0 46V38Z"
            fill="#0054A6"
          />
          {/* Halotel / HaloPesa globe petals */}
          <circle cx="22" cy="22" r="10" fill="#FFFFFF" />
          <path
            d="M16 22C16 17 22 14 22 22C22 30 28 27 28 22"
            stroke="#F37021"
            strokeWidth="2.5"
            fill="none"
          />
          <text
            x="37"
            y="26"
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontSize="14.5"
          >
            HaloPesa
          </text>
          <text
            x="60"
            y="49"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
            fontWeight="800"
            fontSize="7.5"
            letterSpacing="1.5"
          >
            HALOTEL TANZANIA
          </text>
        </svg>
      );

    case 'EZYPESA_TZ':
      return (
        <svg
          viewBox="0 0 120 56"
          className={sizeClass}
          aria-label="EzyPesa Zantel official logo"
        >
          <rect width="120" height="56" rx="10" fill="#009639" />
          <circle cx="22" cy="28" r="12" fill="#8CC63F" />
          <path
            d="M17 24H27L17 32H27"
            stroke="#004D20"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="39"
            y="27"
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontSize="15"
          >
            EzyPesa
          </text>
          <text
            x="39"
            y="41"
            fill="#DCFCE7"
            fontFamily="Arial, sans-serif"
            fontWeight="800"
            fontSize="8"
            letterSpacing="1.4"
          >
            ZANTEL TZ
          </text>
        </svg>
      );

    case 'CRDB_BANK':
      return (
        <svg
          viewBox="0 0 120 56"
          className={sizeClass}
          aria-label="CRDB Bank PLC official logo"
        >
          <rect width="120" height="56" rx="10" fill="#007A33" />
          {/* CRDB Iconic Interlocking Leaf / Diamond Emblem */}
          <g transform="translate(12, 12)">
            <path
              d="M16 0L30 16L16 32L2 16L16 0Z"
              fill="#FFFFFF"
            />
            <path
              d="M16 5L25 16L16 27L7 16L16 5Z"
              fill="#007A33"
            />
            <circle cx="16" cy="16" r="4.5" fill="#8DC63F" />
          </g>
          <text
            x="48"
            y="28"
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontSize="18"
            letterSpacing="1"
          >
            CRDB
          </text>
          <text
            x="48"
            y="41"
            fill="#8DC63F"
            fontFamily="Arial, sans-serif"
            fontWeight="800"
            fontSize="8.5"
            letterSpacing="1.6"
          >
            BANK PLC
          </text>
        </svg>
      );

    case 'NMB_BANK':
      return (
        <svg
          viewBox="0 0 120 56"
          className={sizeClass}
          aria-label="NMB Bank PLC official logo"
        >
          <rect width="120" height="56" rx="10" fill="#004B87" />
          {/* NMB Signature Orange & Gold Arch Swoosh */}
          <path
            d="M14 40C22 16 52 10 106 18C76 18 36 24 14 40Z"
            fill="#F37021"
          />
          <circle cx="24" cy="18" r="5" fill="#FDB913" />
          <text
            x="38"
            y="34"
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontSize="21"
            letterSpacing="1.2"
          >
            NMB
          </text>
          <rect x="0" y="45" width="120" height="11" fill="#F37021" />
          <text
            x="60"
            y="53"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
            fontWeight="800"
            fontSize="6.8"
            letterSpacing="1.5"
          >
            KARIBU YAKO · BANK PLC
          </text>
        </svg>
      );

    case 'NBC_BANK':
      return (
        <svg
          viewBox="0 0 120 56"
          className={sizeClass}
          aria-label="NBC Bank Tanzania official logo"
        >
          <rect width="120" height="56" rx="10" fill="#1A2B6D" />
          {/* NBC Red & White Crest */}
          <circle cx="24" cy="26" r="13" fill="#E31837" />
          <path
            d="M17 28L24 17L31 28L24 24L17 28Z"
            fill="#FFFFFF"
          />
          <text
            x="44"
            y="29"
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontSize="19"
            letterSpacing="1.2"
          >
            NBC
          </text>
          <text
            x="44"
            y="42"
            fill="#FCA5A5"
            fontFamily="Arial, sans-serif"
            fontWeight="800"
            fontSize="7.5"
            letterSpacing="1.2"
          >
            NATIONAL BANK
          </text>
        </svg>
      );

    case 'VISA_CARD':
      return (
        <svg
          viewBox="0 0 120 56"
          className={sizeClass}
          aria-label="Visa official logo"
        >
          <rect width="120" height="56" rx="10" fill="#1A1F71" />
          <rect x="0" y="46" width="120" height="10" fill="#F7B600" />
          <text
            x="60"
            y="35"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontStyle="italic"
            fontSize="27"
            letterSpacing="1.5"
          >
            VISA
          </text>
          <path d="M22 15L33 15L30 22L22 15Z" fill="#F7B600" />
        </svg>
      );

    case 'MASTERCARD':
      return (
        <svg
          viewBox="0 0 120 56"
          className={sizeClass}
          aria-label="Mastercard official logo"
        >
          <rect width="120" height="56" rx="10" fill="#18181B" />
          <circle cx="48" cy="24" r="15" fill="#EB001B" />
          <circle cx="72" cy="24" r="15" fill="#F79E1B" fillOpacity="0.92" />
          <path
            d="M60 12.8C63.8 15.6 66.2 19.6 66.2 24C66.2 28.4 63.8 32.4 60 35.2C56.2 32.4 53.8 28.4 53.8 24C53.8 19.6 56.2 15.6 60 12.8Z"
            fill="#FF5F00"
          />
          <text
            x="60"
            y="49"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
            fontWeight="700"
            fontSize="8.5"
            letterSpacing="0.8"
          >
            mastercard
          </text>
        </svg>
      );

    case 'UNIONPAY_CARD':
      return (
        <svg
          viewBox="0 0 120 56"
          className={sizeClass}
          aria-label="UnionPay official logo"
        >
          <rect width="120" height="56" rx="10" fill="#0F172A" />
          {/* UnionPay Tricolour slanted panels */}
          <polygon points="14,8 44,8 36,48 6,48" fill="#E21836" />
          <polygon points="38,8 76,8 68,48 30,48" fill="#00447C" />
          <polygon points="70,8 112,8 104,48 62,48" fill="#007B84" />
          <text
            x="60"
            y="32"
            textAnchor="middle"
            fill="#FFFFFF"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontStyle="italic"
            fontSize="14.5"
          >
            UnionPay
          </text>
        </svg>
      );
  }
}
