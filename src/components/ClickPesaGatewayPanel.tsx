'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { useLocalization } from '../context/LocalizationContext';
import {
  CLICKPESA_CHANNELS,
  detectTanzanianMnoFromPhone,
  generateClickPesaIdempotencyKey,
  normalizeTanzanianPhone,
} from '../lib/payments/clickpesa';
import {
  executeClickPesaSubscriptionPayment,
  resolveVerifiedTierPricing,
} from '../lib/subscriptions';
import {
  ClickPesaBrandMark,
  ClickPesaProviderLogo,
  PROVIDER_BRAND_THEMES,
} from './ClickPesaBrandLogos';
import {
  PAYMENT_METHOD_TO_PROVIDER_CODE,
  PROVIDER_CODE_TO_PAYMENT_METHOD,
  PaymentMethodSelector,
  type PaymentMethod,
} from './PaymentMethodSelector';
import TurnstileWidget, {
  isTurnstileEnabled,
  type TurnstileWidgetHandle,
} from './TurnstileWidget';
import type {
  BillingCycle,
  ClickPesaProviderCode,
  ClickPesaRail,
  ClickPesaTransactionState,
  PaymentTransactionRecord,
  SubscriptionTierName,
  UserSubscriptionRecord,
} from '../types/database';

export interface ClickPesaGatewayPanelProps {
  userId: string;
  tierName: SubscriptionTierName;
  billingCycle: BillingCycle;
  onSuccess?: (result: {
    subscription: UserSubscriptionRecord;
    transaction: PaymentTransactionRecord;
    webhookSignature?: string;
  }) => void;
}

export default function ClickPesaGatewayPanel({
  userId,
  tierName,
  billingCycle,
  onSuccess,
}: ClickPesaGatewayPanelProps) {
  const { currency, formatPrice, ui } = useLocalization();

  const [selectedProvider, setSelectedProvider] = useState<
    Exclude<ClickPesaProviderCode, 'FREE'>
  >('MPESA_TZ');

  const selectedMethod: PaymentMethod =
    PROVIDER_CODE_TO_PAYMENT_METHOD[selectedProvider];

  const activeChannel = CLICKPESA_CHANNELS[selectedProvider];
  const activeRail: Exclude<ClickPesaRail, 'FREE'> = activeChannel.rail as Exclude<
    ClickPesaRail,
    'FREE'
  >;
  const activeBrandTheme = PROVIDER_BRAND_THEMES[selectedProvider];

  // Mobile Money Form State
  const [phoneInput, setPhoneInput] = useState('+255 754 210 890');

  // Bank Payment Form State
  const [bankAccountHolder, setBankAccountHolder] = useState(
    'Tanzanian Mining Holdings Ltd'
  );
  const [bankAccountNumber, setBankAccountNumber] = useState('0150489210400');

  // International Card Form State
  const [cardholderName, setCardholderName] = useState('J. K. Nyerere');
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8841');
  const [cardExpiry, setCardExpiry] = useState('09/29');
  const [cardCvc, setCardCvc] = useState('842');

  const [pdpaConsent, setPdpaConsent] = useState(true);
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const turnstileEnabled = isTurnstileEnabled();
  const [txState, setTxState] = useState<ClickPesaTransactionState | 'IDLE'>(
    'IDLE'
  );
  const [liveTx, setLiveTx] = useState<PaymentTransactionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifiedPricing = useMemo(
    () => resolveVerifiedTierPricing(tierName, billingCycle),
    [tierName, billingCycle]
  );

  const handleSelectMethod = (
    method: PaymentMethod,
    _channel: 'MOBILE_MONEY' | 'BANK' | 'CARD'
  ) => {
    setError(null);
    const nextCode = PAYMENT_METHOD_TO_PROVIDER_CODE[method];
    setSelectedProvider(nextCode);
  };

  // Auto-detect MNO when typing phone number while on Mobile Money
  useEffect(() => {
    if (activeRail !== 'MOBILE_MONEY') return;
    const detected = detectTanzanianMnoFromPhone(phoneInput);
    if (detected && detected !== 'FREE') {
      setSelectedProvider(detected);
    }
  }, [phoneInput, activeRail]);

  const idempotencyPreview = useMemo(
    () =>
      generateClickPesaIdempotencyKey({
        userId,
        tierName,
        billingCycle,
        providerCode: selectedProvider,
      }),
    [userId, tierName, billingCycle, selectedProvider]
  );

  const formattedDisplayPrice = useMemo(() => {
    if (verifiedPricing.verifiedAmountTzs === 0) {
      return ui('Free (TSh 0)', 'Bure (TSh 0)', 'Gratis (TSh 0)');
    }
    if (currency === 'TZS') {
      return `TSh ${verifiedPricing.verifiedAmountTzs.toLocaleString('en-US')}`;
    }
    return formatPrice(verifiedPricing.verifiedAmountUsd);
  }, [currency, verifiedPricing, formatPrice, ui]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pdpaConsent) {
      setError(
        ui(
          'Please accept the PDPA 2022 and statutory fee separation terms before subscribing.',
          'Tafadhali kubali masharti ya PDPA 2022 kabla ya kuendelea.',
          'Acepte los términos PDPA 2022 antes de continuar.'
        )
      );
      return;
    }

    if (turnstileEnabled && !captchaToken) {
      setError(
        'Completing security check — please wait a moment or refresh if blocked by an ad blocker.'
      );
      return;
    }

    let maskedIdentifier = 'Explorer Free Tier';

    if (verifiedPricing.verifiedAmountTzs > 0) {
      if (activeRail === 'MOBILE_MONEY') {
        const phoneCheck = normalizeTanzanianPhone(phoneInput);
        if (!phoneCheck.valid) {
          setError(phoneCheck.error || 'Invalid Tanzanian mobile number.');
          return;
        }
        maskedIdentifier = phoneCheck.masked;
      } else if (activeRail === 'BANK_TRANSFER') {
        if (bankAccountNumber.replace(/\D/g, '').length < 8) {
          setError(
            'Enter a valid CRDB, NMB, or NBC bank account or SimBanking number.'
          );
          return;
        }
        const cleanAcct = bankAccountNumber.replace(/\s+/g, '');
        maskedIdentifier = `${activeChannel.shortName} •••${cleanAcct.slice(-4)}`;
      } else if (activeRail === 'INTERNATIONAL_CARD') {
        const digits = cardNumber.replace(/\D/g, '');
        if (digits.length < 4 && !cardNumber.includes('••••')) {
          setError('Enter a valid Visa, Mastercard, or UnionPay card number.');
          return;
        }
        maskedIdentifier = `${activeChannel.shortName} •••• ${
          cardNumber.replace(/\D/g, '').slice(-4) || '8841'
        }`;
      }
    }

    setTxState('INITIATED');

    await new Promise((r) => setTimeout(r, 320));
    setTxState('PROCESSING');
    await new Promise((r) => setTimeout(r, 420));

    let res;
    try {
      res = await executeClickPesaSubscriptionPayment({
        userId,
        tierName,
        billingCycle,
        providerCode:
          verifiedPricing.verifiedAmountTzs === 0 ? 'FREE' : selectedProvider,
        accountOrPhoneMasked: maskedIdentifier,
        chargedCurrency: currency,
        chargedAmount:
          currency === 'TZS'
            ? verifiedPricing.verifiedAmountTzs
            : verifiedPricing.verifiedAmountUsd,
        idempotencyKey: idempotencyPreview,
        turnstileToken: captchaToken || undefined,
        onStateChange: (tx) => {
          setLiveTx(tx);
          setTxState(tx.state);
        },
      });
    } finally {
      setCaptchaToken('');
      turnstileRef.current?.reset();
    }

    if (!res.success || !res.subscription || !res.transaction) {
      setTxState('FAILED');
      setError(res.error || 'ClickPesa payment reconciliation failed.');
      return;
    }

    setTxState('SETTLED');
    onSuccess?.({
      subscription: res.subscription,
      transaction: res.transaction,
      webhookSignature: res.webhookSignature,
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-ink/15 bg-white shadow-sm">
      {/* ClickPesa Fintech Header Bar */}
      <div className="border-b border-ink/15 bg-ink px-6 py-5 text-paper">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <ClickPesaBrandMark className="h-8 w-8 shrink-0" />
            <span className="inline-flex items-center gap-1.5 rounded-md bg-gold px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
              <Lock size={12} />
              ClickPesa FinTech Gateway
            </span>
            <span className="rounded-full border border-moss/50 bg-moss/30 px-2.5 py-0.5 font-mono text-[10px] text-[#9de4b4]">
              BoT Licensed · PCI-DSS 3DS 2.0
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-paper/75">
            <KeyRound size={12} className="text-gold" />
            <span>Idempotency:</span>
            <code className="rounded bg-paper/10 px-2 py-0.5 text-[10px] text-gold">
              {idempotencyPreview.slice(0, 26)}…
            </code>
          </div>
        </div>

        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-gold">
              {ui(
                'Server-Verified Tier & Price',
                'Mpango na Bei Iliyothibitishwa',
                'Nivel y Precio Verificado'
              )}
            </p>
            <h3 className="mt-0.5 font-display text-2xl font-light text-paper md:text-3xl">
              {tierName}{' '}
              <span className="text-base font-normal text-paper/70">
                ({billingCycle === 'yearly' ? 'Annual Plan' : 'Monthly Plan'})
              </span>
            </h3>
          </div>

          <div className="text-left sm:text-right">
            <div className="font-display text-3xl font-semibold text-gold">
              {formattedDisplayPrice}
            </div>
            {verifiedPricing.verifiedAmountTzs > 0 && (
              <div className="font-mono text-[11px] text-paper/65">
                TSh {verifiedPricing.verifiedAmountTzs.toLocaleString('en-US')}{' '}
                · US${verifiedPricing.verifiedAmountUsd.toLocaleString('en-US')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="space-y-6 p-6">
        {/* Unified PaymentMethodSelector (Mobile Money, Partner Banks, International Cards) */}
        <PaymentMethodSelector
          selectedMethod={selectedMethod}
          onSelect={handleSelectMethod}
        />

        {/* Branded Active Payment Terminal for Selected Method */}
        {activeRail === 'MOBILE_MONEY' && (
          <div
            style={{
              borderLeftColor: activeBrandTheme.primaryHex,
            }}
            className="rounded-xl border border-ink/15 border-l-4 bg-paper/60 p-5 shadow-xs"
          >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <ClickPesaProviderLogo
                    code={selectedProvider}
                    variant="banner"
                    className="h-11 w-24 rounded-lg shadow-sm"
                  />
                  <div>
                    <span
                      style={{ color: activeBrandTheme.primaryHex }}
                      className="font-mono text-[10px] font-bold uppercase tracking-wider"
                    >
                      {activeBrandTheme.tagline}
                    </span>
                    <h4 className="font-display text-lg font-semibold text-ink">
                      {activeChannel.name} STK Push
                    </h4>
                  </div>
                </div>

                <label htmlFor="cp-mno-phone" className="label">
                  {ui(
                    'Enter Registered Mobile Money Number (+255)',
                    'Ingiza Namba ya Simu ya Malipo (+255)',
                    'Ingrese Número de Teléfono Móvil (+255)'
                  )}
                </label>
                <input
                  id="cp-mno-phone"
                  type="tel"
                  required
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+255 754 210 890"
                  className="field bg-white/95 font-mono text-base font-semibold shadow-2xs"
                />
                <p className="mt-1.5 text-[11px] text-stone">
                  Active Operator:{' '}
                  <strong className="text-ink">{activeChannel.name}</strong> ·
                  USSD Shortcode:{' '}
                  <code className="font-mono font-bold text-ink">
                    {activeChannel.ussdCode}
                  </code>
                </p>
              </div>

              <div className="rounded-xl border border-ink/12 bg-white/90 p-4 font-mono text-xs backdrop-blur-xs">
                <div
                  style={{ color: activeBrandTheme.primaryHex }}
                  className="text-[10px] font-bold uppercase tracking-wider"
                >
                  {activeChannel.shortName} Direct USSD Authorization
                </div>
                <ol className="mt-2 space-y-1.5 text-[11px] text-stone">
                  <li>
                    1. Click{' '}
                    <strong className="text-ink">
                      &ldquo;Subscribe via {activeChannel.shortName}&rdquo;
                    </strong>
                  </li>
                  <li>
                    2. Confirm STK PIN prompt on handset (
                    <strong className="text-ink">
                      {activeChannel.ussdCode}
                    </strong>
                    )
                  </li>
                  <li>
                    3. ClickPesa webhook reconciles &amp; unlocks{' '}
                    <strong className="text-ink">{tierName}</strong>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {activeRail === 'BANK_TRANSFER' && (
          <div
            style={{
              borderLeftColor: activeBrandTheme.primaryHex,
            }}
            className="rounded-xl border border-ink/15 border-l-4 bg-paper/60 p-5 shadow-xs"
          >
            <div>
              <div className="mb-4 flex items-center gap-3">
                <ClickPesaProviderLogo
                  code={selectedProvider}
                  variant="banner"
                  className="h-11 w-24 rounded-lg shadow-sm"
                />
                <div>
                  <span
                    style={{ color: activeBrandTheme.primaryHex }}
                    className="font-mono text-[10px] font-bold uppercase tracking-wider"
                  >
                    {activeBrandTheme.tagline}
                  </span>
                  <h4 className="font-display text-lg font-semibold text-ink">
                    {activeChannel.name} Settlement Desk
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="cp-bank-holder" className="label">
                    {ui(
                      'Account Holder / Mining Company Name',
                      'Jina la Mwenye Akaunti / Kampuni',
                      'Titular de la Cuenta / Empresa'
                    )}
                  </label>
                  <input
                    id="cp-bank-holder"
                    type="text"
                    required
                    value={bankAccountHolder}
                    onChange={(e) => setBankAccountHolder(e.target.value)}
                    className="field bg-white/95 shadow-2xs"
                  />
                </div>

                <div>
                  <label htmlFor="cp-bank-acct" className="label">
                    {activeChannel.shortName}{' '}
                    {ui(
                      'Account / SimBanking / NMB Mkononi Number',
                      'Namba ya Akaunti ya Benki',
                      'Número de Cuenta Bancaria'
                    )}
                  </label>
                  <input
                    id="cp-bank-acct"
                    type="text"
                    required
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    className="field bg-white/95 font-mono font-semibold shadow-2xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeRail === 'INTERNATIONAL_CARD' && (
          <div
            style={{
              borderLeftColor: activeBrandTheme.primaryHex,
            }}
            className="rounded-xl border border-ink/15 border-l-4 bg-paper/60 p-5 shadow-xs"
          >
            <div>
              <div className="mb-4 flex items-center gap-3">
                <ClickPesaProviderLogo
                  code={selectedProvider}
                  variant="banner"
                  className="h-11 w-24 rounded-lg shadow-sm"
                />
                <div>
                  <span
                    style={{ color: activeBrandTheme.primaryHex }}
                    className="font-mono text-[10px] font-bold uppercase tracking-wider"
                  >
                    {activeBrandTheme.tagline}
                  </span>
                  <h4 className="font-display text-lg font-semibold text-ink">
                    {activeChannel.name} Checkout
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="cp-card-name" className="label">
                    {ui(
                      'Cardholder Name',
                      'Jina Kwenye Kadi',
                      'Nombre en la Tarjeta'
                    )}
                  </label>
                  <input
                    id="cp-card-name"
                    type="text"
                    required
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    className="field bg-white/95 shadow-2xs"
                  />
                </div>

                <div>
                  <label htmlFor="cp-card-number" className="label">
                    {activeChannel.shortName}{' '}
                    {ui('Card Number', 'Namba ya Kadi', 'Número de Tarjeta')}
                  </label>
                  <input
                    id="cp-card-number"
                    type="text"
                    required
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="field bg-white/95 font-mono font-semibold shadow-2xs"
                  />
                </div>

                <div>
                  <label htmlFor="cp-card-exp" className="label">
                    {ui(
                      'Expiry (MM/YY)',
                      'Muda wa Kuisha (MM/YY)',
                      'Vencimiento (MM/AA)'
                    )}
                  </label>
                  <input
                    id="cp-card-exp"
                    type="text"
                    required
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    className="field bg-white/95 font-mono shadow-2xs"
                  />
                </div>

                <div>
                  <label htmlFor="cp-card-cvc" className="label">
                    {ui(
                      'CVC / Security Code',
                      'Namba ya Siri (CVC)',
                      'Código CVC'
                    )}
                  </label>
                  <input
                    id="cp-card-cvc"
                    type="password"
                    maxLength={4}
                    required
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    className="field bg-white/95 font-mono shadow-2xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transaction State Machine Progress Indicator */}
        <div className="rounded-xl border border-ink/12 bg-paper p-4 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ochre">
              ClickPesa Transaction State Machine
            </span>
            <span className="text-[10px] text-stone">
              Route: <code>POST /api/payments/create</code> →{' '}
              <code>/api/payments/webhook</code>
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {(
              [
                ['INITIATED', '1. INITIATED'],
                ['PROCESSING', '2. PROCESSING'],
                ['SETTLED', '3. SETTLED'],
              ] as const
            ).map(([stepState, label]) => {
              const isCurrent = txState === stepState;
              const isComplete =
                txState === 'SETTLED' ||
                (txState === 'PROCESSING' && stepState === 'INITIATED');

              return (
                <div
                  key={stepState}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold ${
                    isCurrent
                      ? 'border-ochre bg-ochre/15 text-ink'
                      : isComplete
                        ? 'border-moss/40 bg-moss/15 text-moss'
                        : 'border-ink/10 bg-white/70 text-stone'
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 size={13} className="text-moss" />
                  ) : isCurrent ? (
                    <Loader2 size={13} className="animate-spin text-ochre" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-stone/40" />
                  )}
                  <span>{label}</span>
                </div>
              );
            })}
          </div>

          {liveTx && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-2 text-[11px] text-stone">
              <span>
                Order ID:{' '}
                <strong className="text-ink">
                  {liveTx.clickpesa_order_id}
                </strong>
              </span>
              {liveTx.clickpesa_control_number && (
                <span>
                  Control No:{' '}
                  <strong className="text-ochre">
                    {liveTx.clickpesa_control_number}
                  </strong>
                </span>
              )}
            </div>
          )}
        </div>

        {/* PDPA 2022 & Statutory Fee Separation Consent */}
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink/10 bg-paper/50 p-3.5 text-xs leading-relaxed text-stone">
          <input
            type="checkbox"
            checked={pdpaConsent}
            onChange={(e) => setPdpaConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-ink/30 accent-ochre"
          />
          <span>
            {ui(
              'I acknowledge that MineConnect subscription fees are platform membership fees processed via ClickPesa and are strictly separate from Mining Commission statutory application, annual rent, or transfer fees (PDPA 2022 compliant).',
              'Ninakubali kuwa ada za uanachama wa MineConnect kupitia ClickPesa ni ada za jukwaa pekee na ni tofauti na ada za kisheria za Tume ya Madini (PDPA 2022).',
              'Reconozco que las tarifas de suscripción procesadas vía ClickPesa son independientes de las tasas gubernamentales de la Comisión Minera (PDPA 2022).'
            )}
          </span>
        </label>

        <TurnstileWidget
          ref={turnstileRef}
          theme="light"
          onVerify={(token) => {
            setCaptchaToken(token);
            setError(null);
          }}
          onExpire={() => setCaptchaToken('')}
          onError={(msg) => setError(msg)}
        />

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 font-mono text-[11px] text-stone">
            <ClickPesaProviderLogo
              code={selectedProvider}
              variant="badge"
              className="h-7 w-14 rounded shadow-2xs"
            />
            <ShieldCheck size={15} className="text-moss" />
            <span>
              HMAC-SHA256 Webhook Reconciled · Instant{' '}
              <strong className="text-ink">{tierName}</strong> Unlock
            </span>
          </div>

          <button
            type="submit"
            disabled={txState === 'INITIATED' || txState === 'PROCESSING'}
            style={{
              backgroundColor: activeBrandTheme.primaryHex,
            }}
            className="btn-primary w-full justify-center !py-3.5 !px-6 text-sm text-white shadow-sm transition hover:brightness-110 disabled:opacity-60 sm:w-auto sm:min-w-[280px]"
          >
            {txState === 'INITIATED' || txState === 'PROCESSING' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {ui(
                  `Processing via ${activeChannel.shortName}...`,
                  `Inachakata malipo (${activeChannel.shortName})...`,
                  `Procesando vía ${activeChannel.shortName}...`
                )}
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                {ui(
                  `Subscribe via ${activeChannel.shortName} (${formattedDisplayPrice})`,
                  `Jiunge kupitia ${activeChannel.shortName} (${formattedDisplayPrice})`,
                  `Suscribirse vía ${activeChannel.shortName} (${formattedDisplayPrice})`
                )}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
