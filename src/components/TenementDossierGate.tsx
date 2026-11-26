'use client'

import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Crown,
  FileCheck2,
  Lock,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  ShieldCheck,
  Unlock,
  X,
  Zap,
} from 'lucide-react'
import { useLocalization } from '../context/LocalizationContext'
import { useSubscription } from '../lib/subscriptions'
import type { CounterpartyDossierData } from '../lib/counterpartyDossier'
import VerificationBadge, { VerificationLimitsNotice } from './VerificationBadge'

export interface TenementDossierGateProps {
  dossier: CounterpartyDossierData
  /** 'section' renders inline on detail pages; 'modal' renders an editorial sheet/dialog */
  variant?: 'section' | 'modal'
  /** Optional one-tap RFQ / direct enquiry trigger */
  onTriggerRfq?: () => void
  rfqButtonLabel?: string
  onClose?: () => void
}

export default function TenementDossierGate({
  dossier,
  variant = 'section',
  onTriggerRfq,
  rfqButtonLabel,
  onClose,
}: TenementDossierGateProps) {
  const { ui } = useLocalization()
  const { plan, accountState, isPaidActive, canAccessDataRoom } = useSubscription()

  // Active paid subscribers (Operator Pro, Institutional / JV Desk, or Admin) unlock the full dossier + direct contacts
  const hasDossierAccess = isPaidActive || canAccessDataRoom
  const isDormant = accountState === 'dormant'

  useEffect(() => {
    if (variant !== 'modal' || !onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [variant, onClose])

  const sectionHeading =
    dossier.entityKind === 'service'
      ? ui(
          'Accreditation Dossier & Counterparty Contact',
          'Faili la Uthibitisho na Mawasiliano ya Moja kwa Moja',
          'Expediente Técnico y Contacto Directo',
        )
      : ui(
          'Tenement & Due-Diligence Dossier · Counterparty Contact',
          'Faili la Leseni ya Madini na Mawasiliano ya Moja kwa Moja',
          'Expediente de Concesión y Contacto Directo',
        )

  const body = (
    <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-ink/15 bg-white shadow-sm">
      {/* Header Bar */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 bg-paper-2/90 px-4 py-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-ink px-2 py-0.5 font-mono text-[10px] font-semibold text-gold">
              {dossier.recordCode}
            </span>
            <VerificationBadge level={dossier.verificationLevel} size="sm" />
            {hasDossierAccess ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-moss/40 bg-moss-light px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-moss">
                <Unlock size={11} />
                {ui(
                  `Active · ${plan.name} Unlocked`,
                  `Hai · ${plan.name} Imefunguliwa`,
                  `Activo · ${plan.name}`,
                )}
              </span>
            ) : isDormant ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-danger">
                <Lock size={11} />
                {ui('Dormant · View-Only (Renew)', 'Imesimama · Mtazamaji Pekee', 'Inactivo · Solo Vista')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-ochre/35 bg-ochre/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-ochre">
                <Lock size={11} />
                {ui('Explorer · View-Only Mode', 'Mtazamaji Pekee · Bure', 'Solo Vista · Gratis')}
              </span>
            )}
          </div>
          <h3 className="font-display mt-2 break-words text-xl font-medium leading-snug text-ink sm:text-2xl">
            {variant === 'modal' ? dossier.title : sectionHeading}
          </h3>
          {variant === 'modal' && (
            <p className="mt-0.5 font-mono text-[11px] text-stone">
              {sectionHeading}
            </p>
          )}
        </div>

        {variant === 'modal' && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={ui('Close dossier', 'Funga faili', 'Cerrar expediente')}
            className="shrink-0 rounded-full border border-ink/15 bg-white p-1.5 text-stone transition hover:border-ink hover:text-ink"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Body Content */}
      <div className="space-y-5 p-4 sm:p-6">
        <VerificationLimitsNotice level={dossier.verificationLevel} />
        {hasDossierAccess ? (
          <>
            {/* UNLOCKED: Full Tenement / Accreditation & Due-Diligence Dossier */}
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0 rounded-xl border border-ink/10 bg-paper/70 p-3.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone">
                  {dossier.entityKind === 'service'
                    ? ui('Tenement Classes Served', 'Madaraja ya Leseni', 'Clases Atendidas')
                    : ui('Licence Class', 'Daraja la Leseni', 'Clase de Licencia')}
                </span>
                <div className="mt-1 font-mono text-sm font-bold text-ochre">
                  {dossier.licenceClass}
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-stone">
                  {dossier.licenceClassFull}
                </p>
              </div>

              <div className="min-w-0 rounded-xl border border-ink/10 bg-paper/70 p-3.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone">
                  {ui('Cadastre / Licence Ref', 'Namba ya Leseni', 'Ref. Catastral')}
                </span>
                <div className="mt-1 break-all font-mono text-sm font-bold text-ink tabular-nums">
                  {dossier.licenceReference}
                </div>
                <p className="mt-0.5 text-[11px] text-moss font-medium">
                  {dossier.licenceStatus}
                </p>
              </div>

              <div className="min-w-0 rounded-xl border border-ink/10 bg-paper/70 p-3.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone">
                  {ui('Verification Standing', 'Hali ya Uhakiki', 'Estado de Verificación')}
                </span>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <ShieldCheck size={14} className="shrink-0 text-moss" />
                  <span className="truncate">{dossier.verificationStatus}</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-stone">
                  {dossier.verificationAuthority}
                </p>
              </div>

              <div className="min-w-0 rounded-xl border border-ink/10 bg-paper/70 p-3.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone">
                  {ui('Region / Footprint', 'Mkoa / Eneo', 'Región / Área')}
                </span>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <MapPin size={13} className="shrink-0 text-ochre" />
                  <span className="truncate">{dossier.regionLabel}</span>
                </div>
                {(dossier.areaLabel || dossier.licenceDates) && (
                  <p className="mt-0.5 text-[11px] leading-snug text-stone">
                    {dossier.areaLabel || dossier.licenceDates}
                  </p>
                )}
              </div>
            </div>

            {/* Technical Scope, Assay & Compliance Notes */}
            <div className="rounded-xl border border-ink/10 bg-paper-2/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-ink">
                  <FileCheck2 size={13} className="text-ochre" />
                  {ui(
                    'Technical Scope, Assay & Compliance Notes',
                    'Upeo wa Kiufundi, Maabara na Uzingatiaji Sheria',
                    'Alcance Técnico, Ensayos y Cumplimiento',
                  )}
                </span>
                {dossier.licenceDates && (
                  <span className="font-mono text-[10.5px] text-stone tabular-nums">
                    {dossier.licenceDates}
                  </span>
                )}
              </div>
              <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {dossier.complianceNotes.map((note, idx) => (
                  <li
                    key={`${note.label}-${idx}`}
                    className="flex items-start gap-2 rounded-lg border border-ink/8 bg-white px-3 py-2.5 text-xs"
                  >
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-moss" />
                    <div className="min-w-0">
                      <span className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-ochre">
                        {note.label}
                      </span>
                      <span className="mt-0.5 block leading-relaxed text-ink/85">
                        {note.detail}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Direct Counterparty Contact Card (Unlocked) */}
            <div className="rounded-xl border border-gold/40 bg-ink p-4 text-paper sm:p-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-moss/50 bg-moss/30 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#9de4b4]">
                      <Building2 size={11} />
                      {ui('Direct Counterparty Contact', 'Mawasiliano ya Mhusika', 'Contacto Directo')}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] text-paper/60">
                      <Clock size={10} className="text-gold" />
                      {dossier.responseSla}
                    </span>
                  </div>
                  <h4 className="font-display mt-2 text-xl font-medium text-paper">
                    {dossier.counterpartyName}
                  </h4>
                  <p className="text-xs text-paper/70">{dossier.counterpartyRole}</p>

                  <dl className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div className="min-w-0 rounded-lg border border-paper/12 bg-ink-2 px-3 py-2">
                      <dt className="font-mono text-[9.5px] uppercase tracking-wider text-paper/55">
                        {ui('Direct Phone', 'Simu ya Moja kwa Moja', 'Teléfono Directo')}
                      </dt>
                      <dd className="mt-0.5">
                        <a
                          href={`tel:${dossier.directPhone.replace(/\s+/g, '')}`}
                          className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-gold hover:underline tabular-nums"
                        >
                          <Phone size={12} className="shrink-0" />
                          <span>{dossier.directPhone}</span>
                        </a>
                      </dd>
                    </div>

                    <div className="min-w-0 rounded-lg border border-paper/12 bg-ink-2 px-3 py-2">
                      <dt className="font-mono text-[9.5px] uppercase tracking-wider text-paper/55">
                        {ui('Verified Email', 'Barua Pepe', 'Correo Directo')}
                      </dt>
                      <dd className="mt-0.5">
                        <a
                          href={`mailto:${dossier.directEmail}?subject=${encodeURIComponent(`MineConnect Inquiry: ${dossier.recordCode} — ${dossier.title}`)}`}
                          className="inline-flex max-w-full items-center gap-1.5 truncate font-mono text-xs font-semibold text-gold hover:underline"
                        >
                          <Mail size={12} className="shrink-0" />
                          <span className="truncate">{dossier.directEmail}</span>
                        </a>
                      </dd>
                    </div>

                    <div className="min-w-0 rounded-lg border border-paper/12 bg-ink-2 px-3 py-2 sm:col-span-2">
                      <dt className="font-mono text-[9.5px] uppercase tracking-wider text-paper/55">
                        {ui(
                          'Company Registration & Local Content Standing',
                          'Usajili wa Kampuni (BRELA / TIN)',
                          'Registro Empresarial y Contenido Local',
                        )}
                      </dt>
                      <dd className="mt-0.5 break-words font-mono text-[11px] text-paper/90 tabular-nums">
                        {dossier.companyRegistration} · {dossier.localContentRef}
                      </dd>
                    </div>
                  </dl>
                </div>

                {onTriggerRfq && (
                  <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        if (variant === 'modal' && onClose) onClose()
                        onTriggerRfq()
                      }}
                      className="btn-primary w-full justify-center whitespace-nowrap !px-4 !py-2.5 text-xs sm:w-auto"
                    >
                      <MessageSquareText size={14} />
                      {rfqButtonLabel ||
                        ui('One-Tap Request Quote (RFQ)', 'Omba Bei Papo Hapo (RFQ)', 'Solicitar Cotización (RFQ)')}
                    </button>
                    <span className="text-center font-mono text-[10px] text-paper/55">
                      {ui('Logged to your Vault', 'Inarekodiwa kwenye Hifadhi', 'Guardado en tu Bóveda')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* FREE / DORMANT PREVIEW: Non-broken public summary + Editorial Unlock Card */}
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="min-w-0 rounded-xl border border-ink/10 bg-paper/70 p-3.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone">
                  {dossier.entityKind === 'service'
                    ? ui('Discipline', 'Utaalamu', 'Disciplina')
                    : ui('Mineral / Focus', 'Madini', 'Mineral')}
                </span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {dossier.mineralsOrCategory.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-gold/25 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-ink"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="min-w-0 rounded-xl border border-ink/10 bg-paper/70 p-3.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone">
                  {ui('Region / Mkoa', 'Mkoa', 'Región')}
                </span>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <MapPin size={13} className="shrink-0 text-ochre" />
                  <span className="truncate">{dossier.regionLabel}</span>
                </div>
              </div>

              <div className="min-w-0 rounded-xl border border-ink/10 bg-paper/70 p-3.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-stone">
                  {ui('Verification Preview', 'Uhakiki', 'Verificación')}
                </span>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <ShieldCheck size={14} className="shrink-0 text-moss" />
                  <span className="truncate">{dossier.verificationStatus}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-ink/10 bg-paper-2/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-stone">
                {ui('Public Scope Summary', 'Muhtasari wa Wazi', 'Resumen Público')}
              </span>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/85">
                {dossier.scopeSummary}
              </p>

              {/* Clean redacted preview rows */}
              <div className="mt-4 grid grid-cols-1 gap-2 border-t border-ink/10 pt-3 font-mono text-[11px] text-stone sm:grid-cols-3">
                <div className="flex items-center gap-1.5 truncate">
                  <Lock size={11} className="shrink-0 text-ochre" />
                  <span className="truncate">
                    {ui('Tenement Ref:', 'Leseni:', 'Ref:')}{' '}
                    <span className="select-none text-ink/40">••••••/TZ</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <Phone size={11} className="shrink-0 text-ochre" />
                  <span className="truncate">
                    <span className="select-none text-ink/40">+255 7XX ••• •••</span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <Mail size={11} className="shrink-0 text-ochre" />
                  <span className="truncate">
                    <span className="select-none text-ink/40">desk@••••••.co.tz</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Editorial Unlock Full Tenement Dossier & Direct Contact Card */}
            <div className="contours relative overflow-hidden rounded-xl border border-gold/45 bg-ink p-5 text-paper shadow-md sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/45 bg-ochre/25 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-gold">
                      <Crown size={11} />
                      {isDormant
                        ? ui('Dormant Account · View-Only Mode', 'Akaunti Imesimama · Mtazamaji Pekee', 'Cuenta Inactiva · Solo Vista')
                        : ui('Viewer-Only Account · Paid Unlock Required', 'Akaunti ya Kutazama Pekee', 'Cuenta Solo Vista · Plan Requerido')}
                    </span>
                  </div>

                  <h4 className="font-display mt-2.5 text-xl font-light leading-snug text-paper sm:text-2xl">
                    {ui(
                      'Unlock Full Tenement Dossier, Direct Contact & Quote Requests',
                      'Fungua Faili la Leseni, Mawasiliano na Maombi ya Bei',
                      'Desbloquear Expediente, Contacto Directo y Cotizaciones',
                    )}
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-paper/75">
                    {isDormant
                      ? ui(
                          'Your paid subscription has expired and your account is now in view-only mode (0 listings, 0 quote/info requests). Renew Operator Pro or Institutional / JV Desk in 2 steps to restore full dossiers, direct contacts, and RFQs.',
                          'Mpango wako wa kulipia umeisha na akaunti yako ni ya kutazama pekee. Huisha Operator Pro au Institutional kwa hatua 2 ili kurejesha faili za leseni, mawasiliano na maombi ya bei.',
                          'Tu suscripción venció y tu cuenta está en modo solo vista. Renueva Operator Pro o Institutional en 2 pasos para restaurar expedientes, contactos y cotizaciones.',
                        )
                      : ui(
                          'Explorer (Free) accounts are view-only with 0 quote, information, or due-diligence requests. Upgrade to Operator Pro to unlock PML/PL/ML/SML dossiers, BRELA/TIN registration, direct phone/email contacts, and 25 monthly RFQs.',
                          'Akaunti za Explorer (Bure) ni za kutazama pekee (maombi 0 ya bei au taarifa). Pandisha hadi Operator Pro kufungua faili za leseni, simu/barua pepe ya mhusika, na maombi 25 kwa mwezi.',
                          'Las cuentas Explorer (Gratis) son solo de visualización (0 solicitudes). Actualiza a Operator Pro para desbloquear expedientes, contactos directos y 25 RFQs mensuales.',
                        )}
                  </p>
                </div>

                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
                  <Link
                    to="/pricing"
                    search={{ plan: 'pro', checkout: '1' } as unknown as undefined}
                    onClick={onClose}
                    className="btn-primary w-full justify-center whitespace-nowrap !px-4 !py-2.5 text-xs sm:w-auto"
                  >
                    <Zap size={14} />
                    {isDormant
                      ? ui('Renew & Unlock Now', 'Huisha na Ufungue', 'Renovar Ahora')
                      : ui('Upgrade to Operator Pro', 'Pandisha Operator Pro', 'Activar Operator Pro')}
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )

  if (variant === 'modal') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dossier.title}
        className="fixed inset-0 z-[75] flex items-end justify-center p-0 sm:items-center sm:p-4"
      >
        <div
          className="absolute inset-0 bg-ink/70 backdrop-blur-xs animate-fade"
          onClick={onClose}
        />
        <div className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl animate-rise sm:max-w-3xl sm:rounded-2xl">
          {body}
        </div>
      </div>
    )
  }

  return body
}
