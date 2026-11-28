'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  UploadCloud,
  X,
} from 'lucide-react'
import { submitUserVerificationRequest } from '../lib/supabaseAuth'
import { formatTanzaniaPhoneDisplay } from '../lib/phoneFormat'
import {
  getVerificationDocumentChecklist,
  VERIFICATION_LEVELS,
  VERIFICATION_LEVEL_LIST,
  type VerificationLevelCode,
} from '../lib/verificationLevels'
import {
  formatBytesCompact,
  validateAndCompressVerificationFile,
  type PreparedVerificationFile,
} from '../lib/verificationUpload'
import type { UserProfile } from '../types/database'

export interface VerificationRequestCardProps {
  profile: UserProfile | null
  currentLevel: VerificationLevelCode
  onSubmitted?: () => void
}

export default function VerificationRequestCard({
  profile,
  currentLevel,
  onSubmitted,
}: VerificationRequestCardProps) {
  const [verifCompany, setVerifCompany] = useState('')
  const [verifPhone, setVerifPhone] = useState('')
  const [verifLicenceRef, setVerifLicenceRef] = useState('')
  const [verifRequestedLevel, setVerifRequestedLevel] =
    useState<Exclude<VerificationLevelCode, 'L0'>>('L1')
  const [verifNotes, setVerifNotes] = useState('')
  const [verifSlotFiles, setVerifSlotFiles] = useState<
    Record<string, PreparedVerificationFile>
  >({})
  const [verifSlotErrors, setVerifSlotErrors] = useState<Record<string, string>>({})
  const [verifSlotProcessing, setVerifSlotProcessing] = useState<
    Record<string, boolean>
  >({})
  const [verifFormError, setVerifFormError] = useState<string | null>(null)
  const [verifMessage, setVerifMessage] = useState<string | null>(null)
  const [verifSubmitting, setVerifSubmitting] = useState(false)
  const fieldsInitializedRef = useRef(false)

  useEffect(() => {
    if (!fieldsInitializedRef.current && profile) {
      fieldsInitializedRef.current = true
      if (profile.company_name) {
        setVerifCompany((prev) => (prev ? prev : profile.company_name!))
      }
      if (profile.phone) {
        setVerifPhone((prev) =>
          prev ? prev : formatTanzaniaPhoneDisplay(profile.phone!),
        )
      }
    }
  }, [profile])

  if (currentLevel === 'L4') {
    return null
  }

  const activeChecklist = getVerificationDocumentChecklist(verifRequestedLevel)
  const requiredChecklistSlots = activeChecklist.filter((s) => s.required)
  const attachedRequiredCount = requiredChecklistSlots.filter((s) =>
    Boolean(verifSlotFiles[s.slotKey]),
  ).length
  const anySlotProcessing = Object.values(verifSlotProcessing).some(Boolean)

  const handleSlotFileChange = async (
    slotKey: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    setVerifFormError(null)
    setVerifSlotErrors((prev) => {
      const next = { ...prev }
      delete next[slotKey]
      return next
    })
    if (!file) return

    setVerifSlotProcessing((prev) => ({ ...prev, [slotKey]: true }))
    try {
      const result = await validateAndCompressVerificationFile(file)
      if (!result.ok) {
        setVerifSlotErrors((prev) => ({ ...prev, [slotKey]: result.error }))
      } else {
        setVerifSlotFiles((prev) => ({ ...prev, [slotKey]: result.prepared }))
      }
    } finally {
      setVerifSlotProcessing((prev) => ({ ...prev, [slotKey]: false }))
    }
  }

  const handleRemoveSlotFile = (slotKey: string) => {
    setVerifSlotFiles((prev) => {
      const next = { ...prev }
      delete next[slotKey]
      return next
    })
    setVerifSlotErrors((prev) => {
      const next = { ...prev }
      delete next[slotKey]
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerifMessage(null)
    setVerifFormError(null)

    const missingRequired = activeChecklist.filter(
      (slot) => slot.required && !verifSlotFiles[slot.slotKey],
    )
    if (missingRequired.length > 0) {
      const nextErrors: Record<string, string> = {}
      for (const slot of missingRequired) {
        nextErrors[slot.slotKey] =
          `Required for ${verifRequestedLevel}: please attach a PDF, JPG, PNG, or WebP file (< 10 MB).`
      }
      setVerifSlotErrors((prev) => ({ ...prev, ...nextErrors }))
      setVerifFormError(
        `Please attach all required ${verifRequestedLevel} documents (${missingRequired.length} missing) before submitting.`,
      )
      return
    }

    const preparedDocuments = activeChecklist
      .filter((slot) => Boolean(verifSlotFiles[slot.slotKey]))
      .map((slot) => ({
        slotKey: slot.slotKey,
        label: slot.label,
        required: slot.required,
        prepared: verifSlotFiles[slot.slotKey],
      }))

    setVerifSubmitting(true)
    try {
      const res = await submitUserVerificationRequest({
        companyName: verifCompany,
        phone: verifPhone,
        licenceReference: verifLicenceRef,
        requestedLevel: verifRequestedLevel,
        notes: verifNotes,
        preparedDocuments,
      })
      if (res.error) {
        setVerifFormError(res.error)
      } else {
        setVerifMessage(
          res.warning ||
            `Verification request for ${verifRequestedLevel} (${VERIFICATION_LEVELS[verifRequestedLevel].title}) submitted with ${preparedDocuments.length} labeled document(s). An administrator will review your profile shortly.`,
        )
        setVerifNotes('')
        setVerifSlotFiles((prev) => {
          const next = { ...prev }
          for (const slot of activeChecklist) {
            delete next[slot.slotKey]
          }
          return next
        })
        setVerifSlotErrors({})
        onSubmitted?.()
      }
    } finally {
      setVerifSubmitting(false)
    }
  }

  return (
    <section
      id="submit-verification"
      className="scroll-mt-24 rounded-2xl border border-ink/12 bg-[#FCFBF8] p-5 shadow-xs sm:p-6"
    >
      <div className="mb-4">
        <p className="eyebrow text-ochre">Verification Submission</p>
        <h2 className="mt-1 font-display text-2xl font-medium text-ink">
          Submit or Upgrade Your Verification Level (L1–L4)
        </h2>
        <p className="mt-1 text-xs text-stone">
          Select your target tier below and upload each required supporting document separately (&lt; 10 MB per file).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 border-t border-ink/10 pt-5">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="field-group">
            <label htmlFor="verif-company" className="label">
              Company / Organization
            </label>
            <input
              id="verif-company"
              type="text"
              required
              autoComplete="organization"
              value={verifCompany}
              onChange={(e) => setVerifCompany(e.target.value)}
              placeholder="Enter your company or organization"
              className="field"
            />
          </div>
          <div className="field-group">
            <label htmlFor="verif-phone" className="label">
              Phone Number
            </label>
            <input
              id="verif-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={verifPhone}
              onChange={(e) => setVerifPhone(e.target.value)}
              onBlur={() => setVerifPhone((prev) => formatTanzaniaPhoneDisplay(prev))}
              placeholder="0712 345 678 or +255 712 345 678"
              className="field font-mono tabular-nums"
            />
          </div>
          <div className="field-group">
            <label htmlFor="verif-level" className="label">
              Target Verification Level
            </label>
            <select
              id="verif-level"
              value={verifRequestedLevel}
              onChange={(e) =>
                setVerifRequestedLevel(
                  e.target.value as Exclude<VerificationLevelCode, 'L0'>,
                )
              }
              className="field"
            >
              {VERIFICATION_LEVEL_LIST.filter((v) => v.code !== 'L0').map((v) => (
                <option key={v.code} value={v.code}>
                  {v.code} · {v.title} (Pilot cap: {v.pilotListingQuota})
                </option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="verif-licence-ref" className="label">
              BRELA / Licence Ref
            </label>
            <input
              id="verif-licence-ref"
              type="text"
              value={verifLicenceRef}
              onChange={(e) => setVerifLicenceRef(e.target.value)}
              placeholder="e.g. PML-2026-00412"
              className="field font-mono"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-ink/12 bg-paper/75 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-ink">
                {verifRequestedLevel} Document Checklist · {VERIFICATION_LEVELS[verifRequestedLevel].title}
              </h3>
              <p className="mt-0.5 text-[11.5px] text-stone">
                Upload each document separately (PDF, JPG, PNG, WebP · strictly &lt; 10 MB per file).
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-semibold tabular-nums ${
                attachedRequiredCount === requiredChecklistSlots.length
                  ? 'border-moss/40 bg-moss-light text-moss'
                  : 'border-ochre/35 bg-ochre/10 text-ochre'
              }`}
            >
              {attachedRequiredCount === requiredChecklistSlots.length && (
                <CheckCircle2 size={12} />
              )}
              {attachedRequiredCount} / {requiredChecklistSlots.length} required attached
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {activeChecklist.map((slot, idx) => {
              const attached = verifSlotFiles[slot.slotKey]
              const slotErr = verifSlotErrors[slot.slotKey]
              const processing = Boolean(verifSlotProcessing[slot.slotKey])
              const inputId = `verif-slot-${slot.slotKey}`

              return (
                <div
                  key={slot.slotKey}
                  className={`flex flex-col justify-between rounded-lg border p-3.5 transition-colors ${
                    slotErr
                      ? 'border-danger/50 bg-danger/5'
                      : attached
                        ? 'border-moss/40 bg-moss-light/30'
                        : 'border-ink/12 bg-[#FCFBF8]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-stone tabular-nums">
                        Document {idx + 1}
                      </span>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${
                          slot.required
                            ? 'border-ochre/40 bg-ochre/12 text-ochre'
                            : 'border-ink/15 bg-paper text-stone'
                        }`}
                      >
                        {slot.required ? 'Required' : 'Optional'}
                      </span>
                    </div>

                    <label
                      htmlFor={inputId}
                      className="mt-1.5 block text-xs font-semibold leading-snug text-ink"
                    >
                      {slot.label}
                    </label>
                    <p className="mt-1 text-[11px] leading-relaxed text-stone">
                      {slot.hint}
                    </p>
                  </div>

                  <div className="mt-3">
                    <input
                      id={inputId}
                      type="file"
                      accept=".pdf,image/jpeg,image/png,image/webp"
                      onChange={(e) => void handleSlotFileChange(slot.slotKey, e)}
                      className="sr-only"
                    />

                    {attached ? (
                      <div className="space-y-2 rounded-md border border-moss/30 bg-[#FCFBF8] p-2.5">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-moss" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-[11px] font-semibold text-ink">
                              {attached.fileName}
                            </p>
                            <p className="font-mono text-[10px] text-stone tabular-nums">
                              {formatBytesCompact(attached.compressedBytes)}
                              {attached.wasCompressed ? ' · optimized' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={inputId}
                            className="inline-flex min-h-[36px] flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-ink/15 bg-paper px-2.5 py-1 font-mono text-[10.5px] font-semibold text-ink transition hover:border-ochre hover:text-ochre"
                          >
                            <RefreshCw size={11} />
                            Replace
                          </label>
                          <button
                            type="button"
                            onClick={() => handleRemoveSlotFile(slot.slotKey)}
                            className="inline-flex min-h-[36px] items-center justify-center gap-1 rounded border border-danger/30 bg-danger/5 px-2.5 py-1 font-mono text-[10.5px] font-semibold text-danger transition hover:bg-danger/15"
                          >
                            <X size={12} />
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor={inputId}
                        className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-sand bg-paper/80 px-3 py-2 text-xs font-medium text-ink/80 transition-colors hover:border-ochre hover:text-ochre"
                      >
                        <UploadCloud size={15} className="shrink-0 text-ochre" />
                        <span className="truncate font-mono text-[11px]">
                          {processing
                            ? 'Checking & preparing...'
                            : 'Upload PDF / Image (< 10 MB)'}
                        </span>
                      </label>
                    )}

                    {slotErr && (
                      <p
                        role="alert"
                        className="mt-2 flex items-start gap-1.5 rounded border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-[11px] font-medium text-danger"
                      >
                        <AlertCircle size={13} className="mt-0.5 shrink-0" />
                        <span>{slotErr}</span>
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="field-group">
            <label htmlFor="verif-notes" className="label">
              Reviewer Notes (Optional)
            </label>
            <input
              id="verif-notes"
              type="text"
              value={verifNotes}
              onChange={(e) => setVerifNotes(e.target.value)}
              placeholder="Add licence context or notes for the compliance reviewer"
              className="field"
            />
          </div>
          <button
            type="submit"
            disabled={verifSubmitting || anySlotProcessing}
            className="btn-primary text-xs disabled:opacity-50"
          >
            {verifSubmitting
              ? 'Uploading & Submitting...'
              : profile?.verification_status === 'pending'
                ? `Update ${verifRequestedLevel} Request`
                : `Submit ${verifRequestedLevel} Verification`}
          </button>
        </div>

        {verifFormError && (
          <p
            role="alert"
            className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-medium text-danger"
          >
            {verifFormError}
          </p>
        )}

        {verifMessage && (
          <p
            role="status"
            className="rounded border border-moss/30 bg-moss-light px-3 py-2 text-xs font-medium text-moss"
          >
            {verifMessage}
          </p>
        )}
      </form>
    </section>
  )
}
