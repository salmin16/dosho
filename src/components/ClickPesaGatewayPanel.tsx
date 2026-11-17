'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { useLocalization } from '../context/LocalizationContext';
import {
  CLICKPESA_BANK_LIST,
  CLICKPESA_CARD_LIST,
  CLICKPESA_CHANNELS,
  CLICKPESA_MOBILE_MONEY_LIST,
  detectTanzanianMnoFromPhone,
  generateClickPesaIdempotencyKey,
  normalizeTanzanianPhone,
} from '../lib/payments/clickpesa';
import {
  executeClickPesaSubscriptionPayment,
  resolveVerifiedTierPricing,
} from '../lib/subscriptions';
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

  const [activeRail, setActiveRail] = useState<
    Exclude<ClickPesaRail, 'FREE'>
  >('MOBILE_MONEY');

  const [selectedProvider, setSelectedProvider] = useState<
    Exclude<ClickPesaProviderCode, 'FREE'>
  >('MPESA_TZ');

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
  const [txState, setTxState] = useState<ClickPesaTransactionState | 'IDLE'>(
    'IDLE'
  );
  const [liveTx, setLiveTx] = useState<PaymentTransactionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifiedPricing = useMemo(
    () => resolveVerifiedTierPricing(tierName, billingCycle),
    [tierName, billingCycle]
  );

  // Switch default provider when rail tab changes
  const handleSelectRail = (rail: Exclude<ClickPesaRail, 'FREE'>) => {
    setActiveRail(rail);
    setError(null);
    if (rail === 'MOBILE_MONEY') setSelectedProvider('MPESA_TZ');
    if (rail === 'BANK_TRANSFER') setSelectedProvider('CRDB_BANK');
    if (rail === 'INTERNATIONAL_CARD') setSelectedProvider('VISA_CARD');
  };

  // Auto-detect MNO when typing phone number
  useEffect(() => {
    if (activeRail !== 'MOBILE_MONEY') return;
    const detected = detectTanzanianMnoFromPhone(phoneInput);
    if (detected && detected !== 'FREE') {
      setSelectedProvider(detected);
    }
  }, [phoneInput, activeRail]);

  const activeChannel = CLICKPESA_CHANNELS[selectedProvider];

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
        maskedIdentifier = `${activeChannel.shortName} •••• ${cardNumber
          .replace(/\D/g, '')
          .slice(-4) || '8841'}`;
      }
    }

    setTxState('INITIATED');

    // Step through ClickPesa state machine with brief visual feedback
    await new Promise((r) => setTimeout(r, 320));
    setTxState('PROCESSING');
    await new Promise((r) => setTimeout(r, 420));

    const res = await executeClickPesaSubscriptionPayment({
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
      onStateChange: (tx) => {
        setLiveTx(tx);
        setTxState(tx.state);
      },
    });

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
    <div className="overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-xl">
      {/* ClickPesa Fintech Header Bar */}
      <div className="border-b border-ink/15 bg-ink px-6 py-5 text-paper">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-gold px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
              <Lock size={12} />
              ClickPesa FinTech Gateway
            </span>
            <span className="rounded-full border border-moss/50 bg-moss/30 px-2.5 py-0.5 font-mono text-[10px] text-[#9de4b4]">
              PCI-DSS & BoT Licensed Rails
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

      {/* Rail Selector Tabs: Mobile Money | Bank Payments | International Cards */}
      <div className="border-b border-ink/10 bg-paper px-6 py-3.5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => handleSelectRail('MOBILE_MONEY')}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold transition ${
              activeRail === 'MOBILE_MONEY'
                ? 'border-ochre bg-ink text-paper shadow-sm'
                : 'border-ink/12 bg-white text-ink hover:border-ochre/40'
            }`}
          >
            <Smartphone
              size={15}
              className={
                activeRail === 'MOBILE_MONEY' ? 'text-gold' : 'text-ochre'
              }
            />
            <div className="text-left">
              <div>{ui('Tanzania Mobile Money', 'Malipo ya Simu', 'Dinero Móvil')}</div>
              <div className="font-mono text-[10px] opacity-75">
                M-Pesa · Airtel · Mixx/Tigo · Halo · Ezy
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectRail('BANK_TRANSFER')}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold transition ${
              activeRail === 'BANK_TRANSFER'
                ? 'border-ochre bg-ink text-paper shadow-sm'
                : 'border-ink/12 bg-white text-ink hover:border-ochre/40'
            }`}
          >
            <Building2
              size={15}
              className={
                activeRail === 'BANK_TRANSFER' ? 'text-gold' : 'text-ochre'
              }
            />
            <div className="text-left">
              <div>{ui('Bank Payments (TISS)', 'Malipo ya Benki', 'Pagos Bancarios')}</div>
              <div className="font-mono text-[10px] opacity-75">
                CRDB · NMB · NBC Control No.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectRail('INTERNATIONAL_CARD')}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold transition ${
              activeRail === 'INTERNATIONAL_CARD'
                ? 'border-ochre bg-ink text-paper shadow-sm'
                : 'border-ink/12 bg-white text-ink hover:border-ochre/40'
            }`}
          >
            <CreditCard
              size={15}
              className={
                activeRail === 'INTERNATIONAL_CARD' ? 'text-gold' : 'text-ochre'
              }
            />
            <div className="text-left">
              <div>{ui('International Cards', 'Kadi za Kimataifa', 'Tarjetas')}</div>
              <div className="font-mono text-[10px] opacity-75">
                Visa · Mastercard · UnionPay
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="space-y-6 p-6">
        {/* 1. MOBILE MONEY CHANNEL SELECTOR */}
        {activeRail === 'MOBILE_MONEY' && (
          <div className="space-y-4">
            <div>
              <label className="label">
                {ui(
                  'Select Tanzanian Mobile Money Operator (ClickPesa USSD Push)',
                  'Chagua Mtandao wa Simu (ClickPesa USSD Push)',
                  'Seleccione Operador de Dinero Móvil'
                )}
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {CLICKPESA_MOBILE_MONEY_LIST.map((mno) => {
                  const selected = selectedProvider === mno.code;
                  return (
                    <button
                      key={mno.code}
                      type="button"
                      onClick={() =>
                        setSelectedProvider(
                          mno.code as Exclude<ClickPesaProviderCode, 'FREE'>
                        )
                      }
                      className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
                        selected
                          ? 'border-ochre bg-ink text-paper ring-2 ring-ochre/35'
                          : 'border-ink/12 bg-paper/60 text-ink hover:border-ochre/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: mno.badgeColor }}
                        />
                        <span className="font-mono text-[9px] opacity-70">
                          {mno.ussdCode}
                        </span>
                      </div>
                      <div className="mt-2 font-display text-sm font-semibold">
                        {mno.shortName}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] opacity-70">
                        +255 {mno.prefixes?.join('/')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cp-mno-phone" className="label">
                  {ui(
                    'Mobile Money Phone Number (+255)',
                    'Namba ya Simu ya Malipo (+255)',
                    'Número de Teléfono Móvil (+255)'
                  )}
                </label>
                <input
                  id="cp-mno-phone"
                  type="tel"
                  required
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+255 754 210 890"
                  className="field font-mono"
                />
                <p className="mt-1 text-[11px] text-stone">
                  Auto-detected network:{' '}
                  <strong className="text-ink">{activeChannel.name}</strong> (
                  {activeChannel.ussdCode})
                </p>
              </div>

              <div className="rounded-xl border border-ink/10 bg-paper p-4 font-mono text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-ochre">
                  ClickPesa STK Push Flow
                </div>
                <ol className="mt-2 space-y-1 text-[11px] text-stone">
                  <li>1. Click &ldquo;Subscribe via {activeChannel.shortName}&rdquo;</li>
                  <li>
                    2. Approve PIN prompt on your handset ({activeChannel.ussdCode})
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

        {/* 2. TANZANIAN BANK PAYMENTS (CRDB, NMB, NBC) */}
        {activeRail === 'BANK_TRANSFER' && (
          <div className="space-y-4">
            <div>
              <label className="label">
                {ui(
                  'Select Tanzanian Settlement Bank (ClickPesa Control Number & Direct Debit)',
                  'Chagua Benki ya Malipo (CRDB, NMB, NBC)',
                  'Seleccione Banco de Liquidación (CRDB, NMB, NBC)'
                )}
              </label>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {CLICKPESA_BANK_LIST.map((bank) => {
                  const selected = selectedProvider === bank.code;
                  return (
                    <button
                      key={bank.code}
                      type="button"
                      onClick={() =>
                        setSelectedProvider(
                          bank.code as Exclude<ClickPesaProviderCode, 'FREE'>
                        )
                      }
                      className={`flex flex-col justify-between rounded-xl border p-4 text-left transition ${
                        selected
                          ? 'border-ochre bg-ink text-paper ring-2 ring-ochre/35'
                          : 'border-ink/12 bg-paper/60 text-ink hover:border-ochre/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-base font-semibold">
                          {bank.shortName}
                        </span>
                        <span className="rounded bg-gold/20 px-2 py-0.5 font-mono text-[10px] text-gold">
                          {bank.ussdCode}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs opacity-80">
                        {bank.subtitle}
                      </p>
                      <span className="mt-2 font-mono text-[10px] text-ochre">
                        {bank.settlementTime}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cp-bank-holder" className="label">
                  {ui(
                    'Account Holder / Company Name',
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
                  className="field"
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
                  className="field font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. INTERNATIONAL CARDS (VISA, MASTERCARD, UNIONPAY) */}
        {activeRail === 'INTERNATIONAL_CARD' && (
          <div className="space-y-4">
            <div>
              <label className="label">
                {ui(
                  'Select International Card Network (ClickPesa 3D Secure 2.0)',
                  'Chagua Mtandao wa Kadi ya Kimataifa',
                  'Seleccione Red de Tarjeta Internacional'
                )}
              </label>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {CLICKPESA_CARD_LIST.map((card) => {
                  const selected = selectedProvider === card.code;
                  return (
                    <button
                      key={card.code}
                      type="button"
                      onClick={() =>
                        setSelectedProvider(
                          card.code as Exclude<ClickPesaProviderCode, 'FREE'>
                        )
                      }
                      className={`flex flex-col justify-between rounded-xl border p-4 text-left transition ${
                        selected
                          ? 'border-ochre bg-ink text-paper ring-2 ring-ochre/35'
                          : 'border-ink/12 bg-paper/60 text-ink hover:border-ochre/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-base font-semibold">
                          {card.shortName}
                        </span>
                        <span className="rounded bg-moss/30 px-2 py-0.5 font-mono text-[10px] text-[#9de4b4]">
                          3DS 2.0
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs opacity-80">
                        {card.subtitle}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cp-card-name" className="label">
                  {ui('Cardholder Name', 'Jina Kwenye Kadi', 'Nombre en la Tarjeta')}
                </label>
                <input
                  id="cp-card-name"
                  type="text"
                  required
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  className="field"
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
                  className="field font-mono"
                />
              </div>

              <div>
                <label htmlFor="cp-card-exp" className="label">
                  {ui('Expiry (MM/YY)', 'Muda wa Kuisha (MM/YY)', 'Vencimiento (MM/AA)')}
                </label>
                <input
                  id="cp-card-exp"
                  type="text"
                  required
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  className="field font-mono"
                />
              </div>

              <div>
                <label htmlFor="cp-card-cvc" className="label">
                  {ui('CVC / Security Code', 'Namba ya Siri (CVC)', 'Código CVC')}
                </label>
                <input
                  id="cp-card-cvc"
                  type="password"
                  maxLength={4}
                  required
                  value={cardCvc}
                  onChange={(e) => setCardCvc(e.target.value)}
                  className="field font-mono"
                />
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
                Order ID: <strong className="text-ink">{liveTx.clickpesa_order_id}</strong>
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

        {error && (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-mono text-[11px] text-stone">
            <ShieldCheck size={15} className="text-moss" />
            <span>
              HMAC-SHA256 Webhook Reconciled · Instant{' '}
              <strong className="text-ink">{tierName}</strong> Unlock
            </span>
          </div>

          <button
            type="submit"
            disabled={txState === 'INITIATED' || txState === 'PROCESSING'}
            className="btn-primary min-w-[260px] justify-center !py-3.5 !px-6 text-sm disabled:opacity-60"
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
                <Sparkles size={16} />
                {ui(
                  `Subscribe to ${tierName} (${formattedDisplayPrice})`,
                  `Jiunge na ${tierName} (${formattedDisplayPrice})`,
                  `Suscribirse a ${tierName} (${formattedDisplayPrice})`
                )}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
