import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  FileCheck2,
  MapPin,
  RefreshCw,
  Save,
  ShieldCheck,
  UploadCloud,
  Wrench,
  X,
} from 'lucide-react';
import {
  createGuidedOpportunitySubmission,
  createGuidedServiceSubmission,
  useAuthSession,
} from '../lib/supabaseAuth';
import { useCurrency } from '../lib/currency';
import { TANZANIA_REGIONS_META } from '../data/tanzaniaRegionsGeoJson';
import {
  formatBytesCompact,
  validateAndCompressVerificationFile,
  type PreparedVerificationFile,
} from '../lib/verificationUpload';
import TurnstileWidget, {
  isTurnstileEnabled,
  type TurnstileWidgetHandle,
} from './TurnstileWidget';
import type {
  OpportunitySubmissionCategory,
  ServiceExpertiseArea,
  UserOpportunityRecord,
  UserServiceRecord,
} from '../types/database';

const OPPORTUNITY_DRAFT_KEY = 'mineconnect.draft.guided_opportunity.v2';
const SERVICE_DRAFT_KEY = 'mineconnect.draft.guided_service.v2';

const REGION_NAMES = Object.keys(TANZANIA_REGIONS_META).sort();

// Approximate fallback TZS per 1 USD for clean USD normalization when user enters TZS
const DEFAULT_TZS_PER_USD = 2500;

interface WizardAttachmentSlot {
  slotKey: string;
  label: string;
  required: boolean;
  badgeText: string;
  hint: string;
}

const OPPORTUNITY_CATEGORIES: ReadonlyArray<{
  label: string;
  dbCategory: OpportunitySubmissionCategory;
  badge: string;
  desc: string;
}> = [
  {
    label: 'Joint Venture',
    dbCategory: 'Joint Venture',
    badge: 'EARN-IN / JV',
    desc: 'Farm-in, equity JV, or development partner search on active tenements',
  },
  {
    label: 'Exploration / Mining Tender',
    dbCategory: 'Tender',
    badge: 'PROCUREMENT',
    desc: 'Drilling, haulage, earthworks, laboratory assay, or site contract RFPs',
  },
  {
    label: 'Consultancy',
    dbCategory: 'Consultancy',
    badge: 'TECHNICAL',
    desc: 'JORC/NI 43-101 modeling, ESIA audits, hydrogeology, or legal advisory',
  },
  {
    label: 'Exploration Grant',
    dbCategory: 'Grant',
    badge: 'FUNDING',
    desc: 'ASM formalization grants, clean processing tech, or co-funded exploration',
  },
  {
    label: 'Offtake / Supply',
    dbCategory: 'Equipment Supply',
    badge: 'OFFTAKE & PLANT',
    desc: 'Concentrate/ore offtake, crushing circuits, ball mills, or fleet supply',
  },
  {
    label: 'Internship',
    dbCategory: 'Internship',
    badge: 'TALENT',
    desc: 'Graduate geologist, metallurgist, mine surveyor, or HSE field placements',
  },
] as const;

const OPPORTUNITY_COMMODITIES = [
  'Gold',
  'Copper',
  'Graphite',
  'Lithium / Rare Earths',
  'Gemstones',
  'Coal / Industrial Minerals',
  'Other',
] as const;

const MINERAL_RIGHT_TYPES = ['PML', 'PL', 'ML', 'SML', 'N/A'] as const;

const DEAL_STRUCTURES = [
  'JV Equity',
  'Fixed Budget',
  'Farm-In',
  'Negotiable',
] as const;

const OPPORTUNITY_ATTACHMENT_SLOTS: readonly WizardAttachmentSlot[] = [
  {
    slotKey: 'opp_scope_tor',
    label: 'Project Scope / ToR Document',
    required: true,
    badgeText: 'Required',
    hint: 'Terms of Reference, RFP brief, or project executive summary (PDF, JPG, PNG, WebP · < 10 MB).',
  },
  {
    slotKey: 'opp_licence_map',
    label: 'Licence / Tenement Map Sheet',
    required: false,
    badgeText: 'Optional',
    hint: 'Mining Commission licence copy, tenement boundary sheet, or location map (< 10 MB).',
  },
  {
    slotKey: 'opp_geological_assay',
    label: 'Geological / Assay Summary',
    required: false,
    badgeText: 'Optional',
    hint: 'Summary assay table, sampling highlights, or preliminary geological report (< 10 MB).',
  },
] as const;

const SERVICE_DISCIPLINES: ReadonlyArray<{
  label: string;
  dbExpertise: ServiceExpertiseArea;
  code: string;
  desc: string;
}> = [
  {
    label: 'Drilling',
    dbExpertise: 'Drilling & Core Recovery',
    code: 'DRL',
    desc: 'Diamond core (HQ/NQ), Reverse Circulation (RC), and grade control drilling',
  },
  {
    label: 'Geological & Resource Modeling',
    dbExpertise: 'Geological & Exploration',
    code: 'GEO',
    desc: 'Mapping, geochemistry, geophysics, and JORC / NI 43-101 resource modeling',
  },
  {
    label: 'Assay & Laboratory',
    dbExpertise: 'Assay & Laboratory Testing',
    code: 'LAB',
    desc: 'Fire assay, ICP-MS multi-element, bottle-roll, and metallurgical testing',
  },
  {
    label: 'ESIA & Environmental',
    dbExpertise: 'Environmental (ESIA) & ESG',
    code: 'ESIA',
    desc: 'NEMC ESIA studies, environmental audits, mine closure, and community ESG',
  },
  {
    label: 'Mining Legal & Licensing',
    dbExpertise: 'Legal, Licensing & Cadastre',
    code: 'LEG',
    desc: 'Mining Commission PL/ML/PML filings, JV agreements, and local content compliance',
  },
  {
    label: 'Mine Engineering & Blasting',
    dbExpertise: 'Mine Engineering & EPCM',
    code: 'ENG',
    desc: 'Pit optimization, drill & blast design, geotech, and mine planning',
  },
  {
    label: 'Metallurgy & Processing',
    dbExpertise: 'Mine Engineering & EPCM',
    code: 'MET',
    desc: 'CIL/CIP plant design, comminution, gravity recovery, and tailings engineering',
  },
] as const;

const SERVICE_PRICING_MODELS = [
  'Per Meter',
  'Per Sample',
  'Daily/Monthly Rate',
  'Fixed Quote',
  'RFQ Only',
] as const;

const SERVICE_ACCREDITATIONS = [
  'Mining Commission',
  'NEMC',
  'ISO/IEC 17025',
  'ERB',
] as const;

const SERVICE_ATTACHMENT_SLOTS: readonly WizardAttachmentSlot[] = [
  {
    slotKey: 'srv_capability_profile',
    label: 'Capability Profile / Equipment Sheet',
    required: true,
    badgeText: 'Required',
    hint: 'Company profile, rig/fleet list, or accredited laboratory instrument specification (< 10 MB).',
  },
  {
    slotKey: 'srv_accreditation_cert',
    label: 'Regulatory / Accreditation Certificate',
    required: false,
    badgeText: 'Recommended',
    hint: 'Mining Commission local content, NEMC, ISO/IEC 17025, or ERB registration certificate (< 10 MB).',
  },
  {
    slotKey: 'srv_sample_deliverable',
    label: 'Sample Deliverable / Track Record',
    required: false,
    badgeText: 'Optional',
    hint: 'Redacted report excerpt, assay certificate template, or past client completion letter (< 10 MB).',
  },
] as const;

// Shared per-slot attachment uploader card with strict < 10 MB validation
function AttachmentSlotGrid({
  idPrefix,
  slots,
  files,
  errors,
  processing,
  onFileChange,
  onRemove,
}: {
  idPrefix: string;
  slots: readonly WizardAttachmentSlot[];
  files: Record<string, PreparedVerificationFile>;
  errors: Record<string, string>;
  processing: Record<string, boolean>;
  onFileChange: (slotKey: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (slotKey: string) => void;
}) {
  const requiredCount = slots.filter((s) => s.required).length;
  const attachedRequired = slots.filter((s) => s.required && Boolean(files[s.slotKey])).length;

  return (
    <div className="space-y-3 rounded-xl border border-paper/15 bg-ink-2/90 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-mono text-xs font-semibold uppercase tracking-wider text-gold">
            Structured Supporting Attachments
          </h4>
          <p className="mt-0.5 text-xs text-paper/70">
            Attach each document separately (PDF, JPG, PNG, WebP · strictly &lt; 10 MB per file).
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-semibold tabular-nums ${
            attachedRequired === requiredCount
              ? 'border-moss/50 bg-moss/25 text-[#9de4b4]'
              : 'border-gold/45 bg-gold/15 text-gold'
          }`}
        >
          {attachedRequired === requiredCount && <CheckCircle2 size={12} />}
          {attachedRequired} / {requiredCount} required attached
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {slots.map((slot, idx) => {
          const attached = files[slot.slotKey];
          const slotErr = errors[slot.slotKey];
          const isBusy = Boolean(processing[slot.slotKey]);
          const inputId = `${idPrefix}-${slot.slotKey}`;

          return (
            <div
              key={slot.slotKey}
              className={`flex flex-col justify-between rounded-xl border p-3.5 transition-colors ${
                slotErr
                  ? 'border-danger/60 bg-danger/10'
                  : attached
                    ? 'border-moss/50 bg-moss/15'
                    : 'border-paper/15 bg-ink/80'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-paper/55 tabular-nums">
                    Attachment {idx + 1}
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase ${
                      slot.required
                        ? 'border-gold/50 bg-gold/20 text-gold'
                        : 'border-paper/20 bg-paper/10 text-paper/75'
                    }`}
                  >
                    {slot.badgeText}
                  </span>
                </div>

                <label
                  htmlFor={inputId}
                  className="mt-1.5 block text-xs font-semibold leading-snug text-paper"
                >
                  {slot.label}
                </label>
                <p className="mt-1 text-[11px] leading-relaxed text-paper/65">
                  {slot.hint}
                </p>
              </div>

              <div className="mt-3">
                <input
                  id={inputId}
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => onFileChange(slot.slotKey, e)}
                  className="sr-only"
                />

                {attached ? (
                  <div className="space-y-2 rounded-lg border border-moss/40 bg-ink/90 p-2.5">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#9de4b4]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[11px] font-semibold text-paper">
                          {attached.fileName}
                        </p>
                        <p className="font-mono text-[10px] text-paper/60 tabular-nums">
                          {formatBytesCompact(attached.compressedBytes)}
                          {attached.wasCompressed ? ' · optimized' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={inputId}
                        className="inline-flex min-h-[38px] flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border border-paper/20 bg-paper/10 px-2.5 py-1 font-mono text-[10.5px] font-semibold text-paper transition hover:border-gold hover:text-gold"
                      >
                        <RefreshCw size={11} />
                        Replace
                      </label>
                      <button
                        type="button"
                        onClick={() => onRemove(slot.slotKey)}
                        className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-md border border-danger/45 bg-danger/15 px-2.5 py-1 font-mono text-[10.5px] font-semibold text-[#f59c8a] transition hover:bg-danger/25"
                      >
                        <X size={12} />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor={inputId}
                    className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-paper/30 bg-paper/5 px-3 py-2 text-xs font-medium text-paper/85 transition hover:border-gold hover:text-gold"
                  >
                    <UploadCloud size={15} className="shrink-0 text-gold" />
                    <span className="truncate font-mono text-[11px]">
                      {isBusy ? 'Validating (< 10 MB)...' : 'Choose PDF / Image (< 10 MB)'}
                    </span>
                  </label>
                )}

                {slotErr && (
                  <p
                    role="alert"
                    className="mt-2 flex items-start gap-1.5 rounded border border-danger/40 bg-danger/15 px-2.5 py-1.5 text-[11px] font-medium text-[#f59c8a]"
                  >
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    <span>{slotErr}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 1. GUIDED OPPORTUNITY SUBMISSION WIZARD (`/dashboard/opportunities`)
// ============================================================================
export function GuidedOpportunityWizard({
  onSubmitted,
}: {
  onSubmitted?: (record: UserOpportunityRecord) => void;
}) {
  const session = useAuthSession();
  const { currency, rateForSelected } = useCurrency();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Opportunity & Location
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState(
    session?.user.fullName ? `${session.user.fullName} Operations` : '',
  );
  const [categoryLabel, setCategoryLabel] = useState<string>(
    OPPORTUNITY_CATEGORIES[0].label,
  );
  const [primaryCommodity, setPrimaryCommodity] = useState<string>('Gold');
  const [region, setRegion] = useState<string>('Geita');
  const [district, setDistrict] = useState<string>('');
  const [coordinates, setCoordinates] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Step 2: Tenement & Commercial Terms
  const [mineralRightType, setMineralRightType] = useState<string>('PML');
  const [licenceRef, setLicenceRef] = useState<string>('');
  const [licenceStatusExpiry, setLicenceStatusExpiry] = useState<string>('');
  const [dealStructure, setDealStructure] = useState<string>('JV Equity');
  const [valueCurrency, setValueCurrency] = useState<'USD' | 'TZS'>('USD');
  const [indicativeValue, setIndicativeValue] = useState<string>('125000');
  const [deadline, setDeadline] = useState<string>('2026-12-31');
  const [requirementsText, setRequirementsText] = useState<string>('');

  // Step 3: Structured Attachments & Compliance Checklist
  const [slotFiles, setSlotFiles] = useState<Record<string, PreparedVerificationFile>>({});
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});
  const [slotProcessing, setSlotProcessing] = useState<Record<string, boolean>>({});
  const [checkAuthority, setCheckAuthority] = useState(false);
  const [checkNoUpfrontFee, setCheckNoUpfrontFee] = useState(false);
  const [checkDisclaimer, setCheckDisclaimer] = useState(false);
  const [checkPdpaConsent, setCheckPdpaConsent] = useState(false);
  const [checkListingAgreement, setCheckListingAgreement] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [draftSavedMsg, setDraftSavedMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaFallback, setCaptchaFallback] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const turnstileEnabled = isTurnstileEnabled();
  const [submittedRecord, setSubmittedRecord] = useState<UserOpportunityRecord | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(OPPORTUNITY_DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.title) setTitle(d.title);
        if (d.organization) setOrganization(d.organization);
        if (d.categoryLabel) setCategoryLabel(d.categoryLabel);
        if (d.primaryCommodity) setPrimaryCommodity(d.primaryCommodity);
        if (d.region) setRegion(d.region);
        if (d.district) setDistrict(d.district);
        if (d.coordinates) setCoordinates(d.coordinates);
        if (d.description) setDescription(d.description);
        if (d.mineralRightType) setMineralRightType(d.mineralRightType);
        if (d.licenceRef) setLicenceRef(d.licenceRef);
        if (d.licenceStatusExpiry) setLicenceStatusExpiry(d.licenceStatusExpiry);
        if (d.dealStructure) setDealStructure(d.dealStructure);
        if (d.valueCurrency === 'TZS' || d.valueCurrency === 'USD')
          setValueCurrency(d.valueCurrency);
        if (d.indicativeValue !== undefined) setIndicativeValue(String(d.indicativeValue));
        if (d.deadline) setDeadline(d.deadline);
        if (
          typeof d.requirementsText === 'string' &&
          d.requirementsText.trim() !==
            'Valid Tanzania Mining Commission Local Content Certificate\nTIN & Tax Clearance Certificate\nProven technical and HSE track record'
        ) {
          setRequirementsText(d.requirementsText);
        }
      }
    } catch {
      // ignore malformed draft
    }
  }, []);

  const selectedCategorySpec =
    OPPORTUNITY_CATEGORIES.find((c) => c.label === categoryLabel) ??
    OPPORTUNITY_CATEGORIES[0];

  const numericIndicativeValue = Math.max(0, Number(indicativeValue) || 0);
  const normalizedCompensationUsd =
    valueCurrency === 'TZS'
      ? Math.round(numericIndicativeValue / (currency === 'TZS' && rateForSelected > 0 ? rateForSelected : DEFAULT_TZS_PER_USD))
      : numericIndicativeValue;

  const handleSaveDraft = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      OPPORTUNITY_DRAFT_KEY,
      JSON.stringify({
        title,
        organization,
        categoryLabel,
        primaryCommodity,
        region,
        district,
        coordinates,
        description,
        mineralRightType,
        licenceRef,
        licenceStatusExpiry,
        dealStructure,
        valueCurrency,
        indicativeValue,
        deadline,
        requirementsText,
      }),
    );
    setDraftSavedMsg('Opportunity draft saved locally.');
    window.setTimeout(() => setDraftSavedMsg(null), 3500);
  };

  const handleClearDraft = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(OPPORTUNITY_DRAFT_KEY);
    }
    setTitle('');
    setDistrict('');
    setCoordinates('');
    setDescription('');
    setLicenceRef('');
    setLicenceStatusExpiry('');
    setSlotFiles({});
    setSlotErrors({});
    setCheckAuthority(false);
    setCheckNoUpfrontFee(false);
    setCheckDisclaimer(false);
    setCheckPdpaConsent(false);
    setCheckListingAgreement(false);
    setStep(1);
    setError(null);
  };

  const handleSlotFileChange = async (
    slotKey: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setError(null);
    setSlotErrors((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    if (!file) return;

    setSlotProcessing((prev) => ({ ...prev, [slotKey]: true }));
    try {
      const res = await validateAndCompressVerificationFile(file);
      if (!res.ok) {
        setSlotErrors((prev) => ({ ...prev, [slotKey]: res.error }));
      } else {
        setSlotFiles((prev) => ({ ...prev, [slotKey]: res.prepared }));
      }
    } finally {
      setSlotProcessing((prev) => ({ ...prev, [slotKey]: false }));
    }
  };

  const handleRemoveSlotFile = (slotKey: string) => {
    setSlotFiles((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    setSlotErrors((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  };

  const validateStep1 = (): boolean => {
    if (title.trim().length < 5) {
      setError('Step 1 Validation: Opportunity title must be at least 5 characters.');
      return false;
    }
    if (organization.trim().length < 2) {
      setError('Step 1 Validation: Issuing organization or company name is required.');
      return false;
    }
    if (!region) {
      setError('Step 1 Validation: Please select a Region (Mkoa) in Tanzania.');
      return false;
    }
    if (district.trim().length < 2) {
      setError('Step 1 Validation: Please enter the District (Wilaya) in Tanzania.');
      return false;
    }
    if (description.trim().length < 20) {
      setError('Step 1 Validation: Detailed scope must be at least 20 characters.');
      return false;
    }
    setError(null);
    return true;
  };

  const validateStep2 = (): boolean => {
    if (mineralRightType !== 'N/A' && licenceRef.trim().length < 3) {
      setError(
        `Step 2 Validation: Please enter the ${mineralRightType} Licence Reference Number (or choose N/A if not tenement-specific).`,
      );
      return false;
    }
    if (!deadline) {
      setError('Step 2 Validation: Please specify a valid closing deadline.');
      return false;
    }
    setError(null);
    return true;
  };

  const allChecksComplete =
    checkAuthority &&
    checkNoUpfrontFee &&
    checkDisclaimer &&
    checkPdpaConsent &&
    checkListingAgreement;

  const anySlotBusy = Object.values(slotProcessing).some(Boolean);

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2()) return;

    const missingRequired = OPPORTUNITY_ATTACHMENT_SLOTS.filter(
      (s) => s.required && !slotFiles[s.slotKey],
    );
    if (missingRequired.length > 0) {
      const nextErrs: Record<string, string> = {};
      for (const s of missingRequired) {
        nextErrs[s.slotKey] = `Required attachment: please upload ${s.label} (< 10 MB).`;
      }
      setSlotErrors((prev) => ({ ...prev, ...nextErrs }));
      setError(
        `Step 3 Validation: Please upload all required documents (${missingRequired.map((s) => s.label).join(', ')}).`,
      );
      return;
    }

    if (!allChecksComplete) {
      setError(
        'Step 3 Validation: Please confirm all statutory & compliance declarations before publishing.',
      );
      return;
    }
    if (turnstileEnabled && !captchaToken && !captchaFallback) {
      setError(
        'Waiting for security check to complete — please wait a moment or tap Retry.',
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const requirements = requirementsText
        .split('\n')
        .map((r) => r.trim())
        .filter(Boolean);

      const preparedAttachments = OPPORTUNITY_ATTACHMENT_SLOTS.filter((s) =>
        Boolean(slotFiles[s.slotKey]),
      ).map((s) => ({
        slotKey: s.slotKey,
        label: s.label,
        required: s.required,
        prepared: slotFiles[s.slotKey],
      }));

      const formattedLocation = district.trim()
        ? `${district.trim()}, ${region}`
        : region;

      const res = await createGuidedOpportunitySubmission({
        title: title.trim(),
        organization: organization.trim(),
        category: selectedCategorySpec.dbCategory,
        location: formattedLocation,
        deadline,
        compensationUsd: normalizedCompensationUsd,
        description: description.trim(),
        requirements,
        structuredDetails: {
          categoryLabel: selectedCategorySpec.label,
          primaryCommodity,
          region,
          district: district.trim(),
          coordinates: coordinates.trim() || null,
          mineralRightType,
          licenceReference: licenceRef.trim() || null,
          licenceStatusExpiry: licenceStatusExpiry.trim() || null,
          dealStructure,
          indicativeValue: numericIndicativeValue,
          valueCurrency,
        },
        preparedAttachments,
      });

      if (res.error || !res.opportunity) {
        setError(res.error || 'Failed to submit opportunity.');
        return;
      }

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(OPPORTUNITY_DRAFT_KEY);
      }
      setSubmittedRecord(res.opportunity);
      onSubmitted?.(res.opportunity);
    } finally {
      setSubmitting(false);
      setCaptchaToken('');
      setCaptchaFallback(false);
      turnstileRef.current?.reset();
    }
  };

  const parsedRequirements = requirementsText
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);

  if (submittedRecord) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-gold/40 bg-ink p-6 text-paper shadow-sm sm:p-8">
        <div className="contours absolute inset-0" aria-hidden="true" />
        <div className="relative space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-moss/30 px-3.5 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-gold">
            <CheckCircle2 size={14} />
            Submission Queued · Reference {submittedRecord.reference_code}
          </div>

          <h3 className="font-display text-3xl font-light text-paper">
            Opportunity Submitted for{' '}
            <em className="italic text-gold">Administrative Verification</em>
          </h3>

          <p className="max-w-2xl text-sm leading-relaxed text-paper/75">
            Your opportunity{' '}
            <strong className="text-paper">&ldquo;{submittedRecord.title}&rdquo;</strong>{' '}
            has been saved to <code className="font-mono text-gold">public.opportunities</code>{' '}
            with structured tenement terms and{' '}
            <strong className="text-gold">
              {Object.keys(slotFiles).length} uploaded attachment(s)
            </strong>{' '}
            for Admin inspection.
          </p>

          <div className="grid gap-3 rounded-xl border border-paper/12 bg-ink-2/90 p-5 font-mono text-xs sm:grid-cols-3">
            <div>
              <div className="text-[10px] uppercase text-paper/50">Reference Code</div>
              <div className="mt-0.5 font-bold text-gold">{submittedRecord.reference_code}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-paper/50">Category &amp; Commodity</div>
              <div className="mt-0.5 text-paper">
                {selectedCategorySpec.label} · {primaryCommodity}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-paper/50">Location &amp; Status</div>
              <div className="mt-0.5 text-paper">
                {submittedRecord.location} · <span className="text-gold">PENDING REVIEW</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setSubmittedRecord(null);
                handleClearDraft();
              }}
              className="btn-primary text-xs"
            >
              Publish Another Opportunity
            </button>
            <Link
              to="/dashboard"
              className="inline-flex min-h-[44px] items-center rounded-lg border border-paper/20 bg-paper/10 px-4 py-2 text-xs font-semibold text-paper transition hover:bg-paper/20"
            >
              Return to Vault Overview
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ink/15 bg-ink text-paper shadow-xl">
      {/* Stepper Header */}
      <div className="border-b border-paper/12 bg-ink-2/90 px-5 py-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Briefcase size={18} className="text-gold" />
            <h2 className="font-display text-xl font-semibold text-paper sm:text-2xl">
              Publish Mining Opportunity
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-paper/20 bg-paper/10 px-3 py-1.5 font-mono text-[11px] font-semibold text-paper transition hover:border-gold hover:text-gold"
            >
              <Save size={12} />
              Save Draft
            </button>
            <button
              type="button"
              onClick={handleClearDraft}
              className="inline-flex min-h-[38px] items-center rounded-lg border border-paper/15 px-3 py-1.5 font-mono text-[11px] text-paper/70 transition hover:text-paper"
            >
              Reset
            </button>
          </div>
        </div>

        {/* 3-Step Indicator */}
        <ol className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[
            { num: 1 as const, label: 'Opportunity & Location' },
            { num: 2 as const, label: 'Tenement & Commercial Terms' },
            { num: 3 as const, label: 'Attachments & Review' },
          ].map((s) => {
            const active = step === s.num;
            const completed = step > s.num;
            return (
              <li
                key={s.num}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 font-mono text-xs transition ${
                  active
                    ? 'border-gold bg-gold/15 text-gold font-bold'
                    : completed
                      ? 'border-moss/50 bg-moss/20 text-[#9de4b4]'
                      : 'border-paper/12 bg-ink/60 text-paper/55'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    active
                      ? 'bg-gold text-ink'
                      : completed
                        ? 'bg-[#9de4b4] text-ink'
                        : 'bg-paper/15 text-paper/70'
                  }`}
                >
                  {completed ? '✓' : s.num}
                </span>
                <span className="truncate">{s.label}</span>
              </li>
            );
          })}
        </ol>

        {draftSavedMsg && (
          <p className="mt-3 font-mono text-[11px] text-[#9de4b4]">{draftSavedMsg}</p>
        )}
      </div>

      <form onSubmit={handleFinalSubmit} className="space-y-6 p-5 sm:p-8" noValidate>
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger/50 bg-danger/15 px-4 py-3 text-xs font-medium text-[#f59c8a]"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: OPPORTUNITY & LOCATION */}
        {step === 1 && (
          <div className="space-y-6 animate-rise">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="field-group">
                <label htmlFor="opp-title" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Opportunity Title *
                </label>
                <input
                  id="opp-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. RC Drilling & Resource Upgrade Partner — Lake Victoria Belt"
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                />
              </div>

              <div className="field-group">
                <label htmlFor="opp-org" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Issuing Organization / Company *
                </label>
                <input
                  id="opp-org"
                  type="text"
                  required
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Enter issuing organization or licence holder"
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                />
              </div>
            </div>

            <div className="field-group">
              <span className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                Opportunity Category *
              </span>
              <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {OPPORTUNITY_CATEGORIES.map((cat) => {
                  const active = categoryLabel === cat.label;
                  return (
                    <button
                      key={cat.label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setCategoryLabel(cat.label)}
                      className={`rounded-xl border p-3.5 text-left transition ${
                        active
                          ? 'border-gold bg-gold/15 text-paper ring-1 ring-gold/50'
                          : 'border-paper/15 bg-ink-2/70 text-paper/80 hover:border-paper/35'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-paper">
                          {cat.label}
                        </span>
                        <span className="rounded bg-paper/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-gold">
                          {cat.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-paper/65">
                        {cat.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="field-group">
                <label htmlFor="opp-commodity" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Primary Commodity *
                </label>
                <select
                  id="opp-commodity"
                  value={primaryCommodity}
                  onChange={(e) => setPrimaryCommodity(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3 py-2.5 text-base text-paper focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                >
                  {OPPORTUNITY_COMMODITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="opp-region" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Region (Mkoa) *
                </label>
                <select
                  id="opp-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3 py-2.5 text-base text-paper focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                >
                  {REGION_NAMES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="opp-district" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  District (Wilaya) *
                </label>
                <input
                  id="opp-district"
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Kahama, Geita, Tarime"
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                />
              </div>

              <div className="field-group">
                <label htmlFor="opp-coords" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  GPS / Grid Coordinates (Optional)
                </label>
                <input
                  id="opp-coords"
                  type="text"
                  value={coordinates}
                  onChange={(e) => setCoordinates(e.target.value)}
                  placeholder="e.g. -2.8712, 32.2294"
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 font-mono text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="opp-scope" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                Detailed Scope &amp; Technical Context *
              </label>
              <textarea
                id="opp-scope"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the work scope, geological setting, target deliverables, mobilization expectations, and site access..."
                className="mt-1.5 w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
              />
              <p className="mt-1 font-mono text-[10.5px] text-paper/55">
                Minimum 20 characters ({description.trim().length} entered).
              </p>
            </div>

            <div className="flex justify-end border-t border-paper/12 pt-5">
              <button
                type="button"
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
                className="btn-primary text-xs"
              >
                Continue to Step 2: Tenement &amp; Commercial Terms
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: TENEMENT & COMMERCIAL TERMS */}
        {step === 2 && (
          <div className="space-y-6 animate-rise">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="field-group">
                <label htmlFor="opp-right-type" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Mineral Right Type *
                </label>
                <select
                  id="opp-right-type"
                  value={mineralRightType}
                  onChange={(e) => setMineralRightType(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3 py-2.5 text-base text-paper focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                >
                  {MINERAL_RIGHT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="opp-licence-ref" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Licence Reference Number {mineralRightType !== 'N/A' ? '*' : '(Optional)'}
                </label>
                <input
                  id="opp-licence-ref"
                  type="text"
                  value={licenceRef}
                  onChange={(e) => setLicenceRef(e.target.value)}
                  placeholder="e.g. PML-2026-00412 or PL-11820/2024"
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 font-mono text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                />
              </div>

              <div className="field-group">
                <label htmlFor="opp-licence-status" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Licence Status / Expiry
                </label>
                <input
                  id="opp-licence-status"
                  type="text"
                  value={licenceStatusExpiry}
                  onChange={(e) => setLicenceStatusExpiry(e.target.value)}
                  placeholder="e.g. Active · Valid through Nov 2029"
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="field-group">
                <label htmlFor="opp-deal-structure" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Deal / Budget Structure *
                </label>
                <select
                  id="opp-deal-structure"
                  value={dealStructure}
                  onChange={(e) => setDealStructure(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3 py-2.5 text-base text-paper focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                >
                  {DEAL_STRUCTURES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="opp-value" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Indicative Value ({valueCurrency})
                </label>
                <div className="mt-1.5 flex gap-2">
                  <select
                    aria-label="Value currency"
                    value={valueCurrency}
                    onChange={(e) => setValueCurrency(e.target.value as 'USD' | 'TZS')}
                    className="min-h-[44px] rounded-lg border border-paper/20 bg-ink-2 px-2.5 py-2 font-mono text-base font-semibold text-gold focus:border-gold focus:outline-none"
                  >
                    <option value="USD">USD</option>
                    <option value="TZS">TZS</option>
                  </select>
                  <input
                    id="opp-value"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    value={indicativeValue}
                    onChange={(e) => setIndicativeValue(e.target.value)}
                    placeholder="0"
                    className="min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 font-mono text-base text-paper tabular-nums placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                  />
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="opp-deadline" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Closing Deadline *
                </label>
                <input
                  id="opp-deadline"
                  type="date"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 font-mono text-base text-paper focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="opp-requirements" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                Counterparty Requirements (One per line)
              </label>
              <textarea
                id="opp-requirements"
                rows={4}
                value={requirementsText}
                onChange={(e) => setRequirementsText(e.target.value)}
                placeholder="List mandatory technical, financial, local-content, or compliance qualifications..."
                className="mt-1.5 w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper/12 pt-5">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-paper/20 bg-paper/10 px-4 py-2 text-xs font-semibold text-paper transition hover:bg-paper/20"
              >
                <ArrowLeft size={14} />
                Back to Step 1
              </button>
              <button
                type="button"
                onClick={() => {
                  if (validateStep2()) setStep(3);
                }}
                className="btn-primary text-xs"
              >
                Continue to Step 3: Attachments &amp; Review
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: STRUCTURED ATTACHMENTS & REVIEW */}
        {step === 3 && (
          <div className="space-y-6 animate-rise">
            <AttachmentSlotGrid
              idPrefix="opp-att"
              slots={OPPORTUNITY_ATTACHMENT_SLOTS}
              files={slotFiles}
              errors={slotErrors}
              processing={slotProcessing}
              onFileChange={(slotKey, e) => void handleSlotFileChange(slotKey, e)}
              onRemove={handleRemoveSlotFile}
            />

            {/* Clean Pre-Submission Review Summary */}
            <div className="rounded-xl border border-paper/15 bg-ink-2/90 p-5">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-gold">
                <ClipboardCheck size={14} />
                Review Summary Before Submission
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="font-mono text-[10px] uppercase text-paper/50">Opportunity</dt>
                  <dd className="mt-0.5 font-semibold text-paper">{title}</dd>
                  <dd className="text-[11px] text-paper/65">{organization}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-paper/50">Category &amp; Commodity</dt>
                  <dd className="mt-0.5 font-semibold text-gold">
                    {selectedCategorySpec.label} · {primaryCommodity}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-paper/50">Location</dt>
                  <dd className="mt-0.5 inline-flex items-center gap-1 text-paper">
                    <MapPin size={12} className="text-gold" />
                    {district}, {region}
                    {coordinates ? ` (${coordinates})` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-paper/50">Tenement / Licence</dt>
                  <dd className="mt-0.5 font-mono text-paper">
                    {mineralRightType}
                    {licenceRef ? ` · ${licenceRef}` : ''}
                    {licenceStatusExpiry ? ` (${licenceStatusExpiry})` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-paper/50">Commercial Terms</dt>
                  <dd className="mt-0.5 inline-flex items-center gap-1 font-mono text-paper tabular-nums">
                    <Coins size={12} className="text-gold" />
                    {dealStructure} ·{' '}
                    {numericIndicativeValue > 0
                      ? `${valueCurrency} ${numericIndicativeValue.toLocaleString('en-US')}`
                      : 'Negotiable'}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-paper/50">Closing Deadline</dt>
                  <dd className="mt-0.5 font-mono text-paper">{deadline}</dd>
                </div>
              </dl>

              {parsedRequirements.length > 0 && (
                <div className="mt-3 border-t border-paper/10 pt-3">
                  <div className="font-mono text-[10px] uppercase text-paper/50">
                    Counterparty Requirements ({parsedRequirements.length})
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {parsedRequirements.map((req, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded border border-paper/15 bg-paper/5 px-2 py-0.5 text-[11px] text-paper/80"
                      >
                        <FileCheck2 size={10} className="text-[#9de4b4]" />
                        {req}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Statutory Compliance Checklist */}
            <div className="space-y-2.5 rounded-xl border border-paper/15 bg-ink-2/70 p-4 text-xs text-paper/85">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-gold">
                <ShieldCheck size={13} />
                Compliance &amp; Anti-Fraud Declarations
              </div>
              {[
                {
                  id: 'opp-chk-auth',
                  checked: checkAuthority,
                  onChange: setCheckAuthority,
                  label:
                    'I confirm I am authorised by the licence holder or issuing organization to publish this opportunity.',
                },
                {
                  id: 'opp-chk-fee',
                  checked: checkNoUpfrontFee,
                  onChange: setCheckNoUpfrontFee,
                  label:
                    'No prohibited upfront facilitation fees or misleading grade/reserve claims are included.',
                },
                {
                  id: 'opp-chk-disc',
                  checked: checkDisclaimer,
                  onChange: setCheckDisclaimer,
                  label:
                    'I understand MineConnect performs moderation checks and is not a broker, escrow agent, or guarantor.',
                },
                {
                  id: 'opp-chk-pdpa',
                  checked: checkPdpaConsent,
                  onChange: setCheckPdpaConsent,
                  label:
                    'I consent to Tanzania PDPA-compliant processing of submitted business and attachment records for review.',
                },
                {
                  id: 'opp-chk-agree',
                  checked: checkListingAgreement,
                  onChange: setCheckListingAgreement,
                  label:
                    'I accept the MineConnect Listing Guidelines & Terms of Use.',
                },
              ].map((item) => (
                <label
                  key={item.id}
                  htmlFor={item.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-paper/10 bg-ink/50 p-2.5"
                >
                  <input
                    id={item.id}
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.onChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-ochre"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            {turnstileEnabled && (
              <TurnstileWidget
                ref={turnstileRef}
                theme="dark"
                timeoutMs={8000}
                allowMobileFallback
                fallbackLabel="Verified via signed-in session"
                onVerify={(token) => {
                  setCaptchaToken(token);
                  setCaptchaFallback(false);
                  setError(null);
                }}
                onExpire={() => setCaptchaToken('')}
                onFallbackReady={() => {
                  setCaptchaFallback(true);
                  setError(null);
                }}
                onError={() => setCaptchaFallback(true)}
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper/12 pt-5">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-paper/20 bg-paper/10 px-4 py-2 text-xs font-semibold text-paper transition hover:bg-paper/20"
              >
                <ArrowLeft size={14} />
                Back to Step 2
              </button>
              <button
                type="submit"
                disabled={submitting || anySlotBusy}
                className="btn-primary text-xs disabled:opacity-50"
              >
                {submitting
                  ? 'Uploading Attachments & Publishing...'
                  : 'Submit Opportunity for Admin Verification'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

// ============================================================================
// 2. GUIDED TECHNICAL SERVICE SUBMISSION WIZARD (`/dashboard/services`)
// ============================================================================
export function GuidedServiceWizard({
  onSubmitted,
}: {
  onSubmitted?: (record: UserServiceRecord) => void;
}) {
  const session = useAuthSession();
  const { currency, formatExactUsd, rateForSelected } = useCurrency();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Discipline & Coverage
  const [serviceName, setServiceName] = useState('');
  const [providerOrganization, setProviderOrganization] = useState(
    session?.user.fullName ? `${session.user.fullName} Technical Services` : '',
  );
  const [disciplineLabel, setDisciplineLabel] = useState<string>(
    SERVICE_DISCIPLINES[0].label,
  );
  const [selectedRegions, setSelectedRegions] = useState<string[]>([
    'Geita',
    'Mwanza',
    'Shinyanga',
  ]);
  const [customCoverage, setCustomCoverage] = useState('');
  const [equipmentStandards, setEquipmentStandards] = useState('');
  const [scopeDescription, setScopeDescription] = useState('');

  // Step 2: Rates & Accreditation
  const [pricingModel, setPricingModel] = useState<string>(SERVICE_PRICING_MODELS[0]);
  const [rateCurrency, setRateCurrency] = useState<'USD' | 'TZS'>('USD');
  const [startingRate, setStartingRate] = useState<string>('120');
  const [leadTime, setLeadTime] = useState<string>('5–10 business days mobilization');
  const [selectedAccreditations, setSelectedAccreditations] = useState<string[]>([
    'Mining Commission',
  ]);
  const [extraCertNotes, setExtraCertNotes] = useState('');
  const [portfolioLinks, setPortfolioLinks] = useState('');

  // Step 3: Credentials, Attachments & Review
  const [slotFiles, setSlotFiles] = useState<Record<string, PreparedVerificationFile>>({});
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});
  const [slotProcessing, setSlotProcessing] = useState<Record<string, boolean>>({});
  const [checkAccreditation, setCheckAccreditation] = useState(false);
  const [checkFeeSeparation, setCheckFeeSeparation] = useState(false);
  const [checkNoGuarantee, setCheckNoGuarantee] = useState(false);
  const [checkPdpa, setCheckPdpa] = useState(false);
  const [checkServiceListingAgreement, setCheckServiceListingAgreement] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [draftSavedMsg, setDraftSavedMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaFallback, setCaptchaFallback] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const turnstileEnabled = isTurnstileEnabled();
  const [submittedRecord, setSubmittedRecord] = useState<UserServiceRecord | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SERVICE_DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.serviceName) setServiceName(d.serviceName);
        if (d.providerOrganization) setProviderOrganization(d.providerOrganization);
        if (d.disciplineLabel) setDisciplineLabel(d.disciplineLabel);
        if (Array.isArray(d.selectedRegions)) setSelectedRegions(d.selectedRegions);
        if (d.customCoverage) setCustomCoverage(d.customCoverage);
        if (d.equipmentStandards) setEquipmentStandards(d.equipmentStandards);
        if (d.scopeDescription) setScopeDescription(d.scopeDescription);
        if (d.pricingModel) setPricingModel(d.pricingModel);
        if (d.rateCurrency === 'TZS' || d.rateCurrency === 'USD')
          setRateCurrency(d.rateCurrency);
        if (d.startingRate !== undefined) setStartingRate(String(d.startingRate));
        if (d.leadTime) setLeadTime(d.leadTime);
        if (Array.isArray(d.selectedAccreditations))
          setSelectedAccreditations(d.selectedAccreditations);
        if (d.extraCertNotes) setExtraCertNotes(d.extraCertNotes);
        if (d.portfolioLinks) setPortfolioLinks(d.portfolioLinks);
      }
    } catch {
      // ignore malformed draft
    }
  }, []);

  const selectedDisciplineSpec =
    SERVICE_DISCIPLINES.find((d) => d.label === disciplineLabel) ??
    SERVICE_DISCIPLINES[0];

  const numericRate = pricingModel === 'RFQ Only' ? 0 : Math.max(0, Number(startingRate) || 0);
  const normalizedRateUsd =
    rateCurrency === 'TZS'
      ? Math.round(
          numericRate /
            (currency === 'TZS' && rateForSelected > 0 ? rateForSelected : DEFAULT_TZS_PER_USD),
        )
      : numericRate;

  const combinedCoverage = [
    ...selectedRegions,
    ...customCoverage
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ].join(', ');

  const combinedCertifications = [
    ...selectedAccreditations,
    extraCertNotes.trim(),
  ]
    .filter(Boolean)
    .join(' · ');

  const toggleRegion = (reg: string) => {
    setSelectedRegions((prev) =>
      prev.includes(reg) ? prev.filter((r) => r !== reg) : [...prev, reg],
    );
  };

  const toggleAccreditation = (acc: string) => {
    setSelectedAccreditations((prev) =>
      prev.includes(acc) ? prev.filter((a) => a !== acc) : [...prev, acc],
    );
  };

  const handleSaveDraft = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      SERVICE_DRAFT_KEY,
      JSON.stringify({
        serviceName,
        providerOrganization,
        disciplineLabel,
        selectedRegions,
        customCoverage,
        equipmentStandards,
        scopeDescription,
        pricingModel,
        rateCurrency,
        startingRate,
        leadTime,
        selectedAccreditations,
        extraCertNotes,
        portfolioLinks,
      }),
    );
    setDraftSavedMsg('Service draft saved locally.');
    window.setTimeout(() => setDraftSavedMsg(null), 3500);
  };

  const handleClearDraft = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SERVICE_DRAFT_KEY);
    }
    setServiceName('');
    setEquipmentStandards('');
    setScopeDescription('');
    setExtraCertNotes('');
    setPortfolioLinks('');
    setSlotFiles({});
    setSlotErrors({});
    setCheckAccreditation(false);
    setCheckFeeSeparation(false);
    setCheckNoGuarantee(false);
    setCheckPdpa(false);
    setCheckServiceListingAgreement(false);
    setStep(1);
    setError(null);
  };

  const handleSlotFileChange = async (
    slotKey: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setError(null);
    setSlotErrors((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    if (!file) return;

    setSlotProcessing((prev) => ({ ...prev, [slotKey]: true }));
    try {
      const res = await validateAndCompressVerificationFile(file);
      if (!res.ok) {
        setSlotErrors((prev) => ({ ...prev, [slotKey]: res.error }));
      } else {
        setSlotFiles((prev) => ({ ...prev, [slotKey]: res.prepared }));
      }
    } finally {
      setSlotProcessing((prev) => ({ ...prev, [slotKey]: false }));
    }
  };

  const handleRemoveSlotFile = (slotKey: string) => {
    setSlotFiles((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    setSlotErrors((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  };

  const validateStep1 = (): boolean => {
    if (serviceName.trim().length < 5) {
      setError('Step 1 Validation: Service title must be at least 5 characters.');
      return false;
    }
    if (providerOrganization.trim().length < 2) {
      setError('Step 1 Validation: Provider firm or organization name is required.');
      return false;
    }
    if (!combinedCoverage.trim()) {
      setError('Step 1 Validation: Please select at least one coverage region in Tanzania.');
      return false;
    }
    if (scopeDescription.trim().length < 20) {
      setError('Step 1 Validation: Service description must be at least 20 characters.');
      return false;
    }
    setError(null);
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!pricingModel) {
      setError('Step 2 Validation: Please select a pricing model.');
      return false;
    }
    if (!leadTime.trim()) {
      setError('Step 2 Validation: Please specify turnaround or mobilization lead time.');
      return false;
    }
    setError(null);
    return true;
  };

  const allChecksComplete =
    checkAccreditation &&
    checkFeeSeparation &&
    checkNoGuarantee &&
    checkPdpa &&
    checkServiceListingAgreement;

  const anySlotBusy = Object.values(slotProcessing).some(Boolean);

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2()) return;

    const missingRequired = SERVICE_ATTACHMENT_SLOTS.filter(
      (s) => s.required && !slotFiles[s.slotKey],
    );
    if (missingRequired.length > 0) {
      const nextErrs: Record<string, string> = {};
      for (const s of missingRequired) {
        nextErrs[s.slotKey] = `Required attachment: please upload ${s.label} (< 10 MB).`;
      }
      setSlotErrors((prev) => ({ ...prev, ...nextErrs }));
      setError(
        `Step 3 Validation: Please upload all required documents (${missingRequired.map((s) => s.label).join(', ')}).`,
      );
      return;
    }

    if (!allChecksComplete) {
      setError(
        'Step 3 Validation: Please confirm all professional service verification declarations before publishing.',
      );
      return;
    }
    if (turnstileEnabled && !captchaToken && !captchaFallback) {
      setError(
        'Waiting for security check to complete — please wait a moment or tap Retry.',
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const preparedAttachments = SERVICE_ATTACHMENT_SLOTS.filter((s) =>
        Boolean(slotFiles[s.slotKey]),
      ).map((s) => ({
        slotKey: s.slotKey,
        label: s.label,
        required: s.required,
        prepared: slotFiles[s.slotKey],
      }));

      const formattedPricingLabel =
        pricingModel === 'RFQ Only'
          ? 'RFQ Only'
          : `${pricingModel} (${rateCurrency} ${numericRate.toLocaleString('en-US')})`;

      const res = await createGuidedServiceSubmission({
        serviceName: serviceName.trim(),
        providerOrganization: providerOrganization.trim(),
        expertiseArea: selectedDisciplineSpec.dbExpertise,
        regionalCoverage: combinedCoverage.slice(0, 195),
        rateOrPricingModel: formattedPricingLabel,
        estimatedRateUsd: normalizedRateUsd,
        scopeDescription: scopeDescription.trim(),
        portfolioLinks: portfolioLinks.trim(),
        certifications: combinedCertifications || 'Standard Commercial Provider',
        structuredDetails: {
          disciplineLabel: selectedDisciplineSpec.label,
          coverageRegions: selectedRegions,
          equipmentStandards: equipmentStandards.trim() || null,
          pricingModel,
          startingRate: numericRate,
          rateCurrency,
          leadTime: leadTime.trim(),
          accreditations: selectedAccreditations,
          extraCertNotes: extraCertNotes.trim() || null,
        },
        preparedAttachments,
      });

      if (res.error || !res.service) {
        setError(res.error || 'Failed to submit service.');
        return;
      }

      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(SERVICE_DRAFT_KEY);
      }
      setSubmittedRecord(res.service);
      onSubmitted?.(res.service);
    } finally {
      setSubmitting(false);
      setCaptchaToken('');
      setCaptchaFallback(false);
      turnstileRef.current?.reset();
    }
  };

  if (submittedRecord) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-gold/40 bg-ink p-6 text-paper shadow-sm sm:p-8">
        <div className="contours absolute inset-0" aria-hidden="true" />
        <div className="relative space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-moss/30 px-3.5 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-gold">
            <CheckCircle2 size={14} />
            Service Listing Queued · Reference {submittedRecord.reference_code}
          </div>

          <h3 className="font-display text-3xl font-light text-paper">
            Technical Service Submitted for{' '}
            <em className="italic text-gold">Administrative Verification</em>
          </h3>

          <p className="max-w-2xl text-sm leading-relaxed text-paper/75">
            Your service{' '}
            <strong className="text-paper">&ldquo;{submittedRecord.service_name}&rdquo;</strong>{' '}
            has been saved to <code className="font-mono text-gold">public.services</code> with
            accreditation details and{' '}
            <strong className="text-gold">
              {Object.keys(slotFiles).length} uploaded attachment(s)
            </strong>{' '}
            for Admin inspection.
          </p>

          <div className="grid gap-3 rounded-xl border border-paper/12 bg-ink-2/90 p-5 font-mono text-xs sm:grid-cols-3">
            <div>
              <div className="text-[10px] uppercase text-paper/50">Reference Code</div>
              <div className="mt-0.5 font-bold text-gold">{submittedRecord.reference_code}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-paper/50">Discipline &amp; Pricing</div>
              <div className="mt-0.5 text-paper">
                {selectedDisciplineSpec.label} · {submittedRecord.rate_or_pricing_model}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-paper/50">Status</div>
              <div className="mt-0.5 font-bold text-gold">PENDING REVIEW</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setSubmittedRecord(null);
                handleClearDraft();
              }}
              className="btn-primary text-xs"
            >
              Publish Another Service
            </button>
            <Link
              to="/dashboard"
              className="inline-flex min-h-[44px] items-center rounded-lg border border-paper/20 bg-paper/10 px-4 py-2 text-xs font-semibold text-paper transition hover:bg-paper/20"
            >
              Return to Vault Overview
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ink/15 bg-ink text-paper shadow-xl">
      {/* Stepper Header */}
      <div className="border-b border-paper/12 bg-ink-2/90 px-5 py-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Wrench size={18} className="text-gold" />
            <h2 className="font-display text-xl font-semibold text-paper sm:text-2xl">
              Publish Technical Service
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-paper/20 bg-paper/10 px-3 py-1.5 font-mono text-[11px] font-semibold text-paper transition hover:border-gold hover:text-gold"
            >
              <Save size={12} />
              Save Draft
            </button>
            <button
              type="button"
              onClick={handleClearDraft}
              className="inline-flex min-h-[38px] items-center rounded-lg border border-paper/15 px-3 py-1.5 font-mono text-[11px] text-paper/70 transition hover:text-paper"
            >
              Reset
            </button>
          </div>
        </div>

        <ol className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[
            { num: 1 as const, label: 'Discipline & Coverage' },
            { num: 2 as const, label: 'Rates & Accreditation' },
            { num: 3 as const, label: 'Credentials, Attachments & Review' },
          ].map((s) => {
            const active = step === s.num;
            const completed = step > s.num;
            return (
              <li
                key={s.num}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 font-mono text-xs transition ${
                  active
                    ? 'border-gold bg-gold/15 text-gold font-bold'
                    : completed
                      ? 'border-moss/50 bg-moss/20 text-[#9de4b4]'
                      : 'border-paper/12 bg-ink/60 text-paper/55'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    active
                      ? 'bg-gold text-ink'
                      : completed
                        ? 'bg-[#9de4b4] text-ink'
                        : 'bg-paper/15 text-paper/70'
                  }`}
                >
                  {completed ? '✓' : s.num}
                </span>
                <span className="truncate">{s.label}</span>
              </li>
            );
          })}
        </ol>

        {draftSavedMsg && (
          <p className="mt-3 font-mono text-[11px] text-[#9de4b4]">{draftSavedMsg}</p>
        )}
      </div>

      <form onSubmit={handleFinalSubmit} className="space-y-6 p-5 sm:p-8" noValidate>
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger/50 bg-danger/15 px-4 py-3 text-xs font-medium text-[#f59c8a]"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: DISCIPLINE & COVERAGE */}
        {step === 1 && (
          <div className="space-y-6 animate-rise">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="field-group">
                <label htmlFor="srv-title" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Service Title *
                </label>
                <input
                  id="srv-title"
                  type="text"
                  required
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="e.g. Multi-Purpose RC & Diamond Core Drilling Rig Services"
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                />
              </div>

              <div className="field-group">
                <label htmlFor="srv-org" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Provider Firm / Organization *
                </label>
                <input
                  id="srv-org"
                  type="text"
                  required
                  value={providerOrganization}
                  onChange={(e) => setProviderOrganization(e.target.value)}
                  placeholder="Enter your registered service company"
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                />
              </div>
            </div>

            <div className="field-group">
              <span className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                Technical Discipline *
              </span>
              <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {SERVICE_DISCIPLINES.map((disc) => {
                  const active = disciplineLabel === disc.label;
                  return (
                    <button
                      key={disc.label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setDisciplineLabel(disc.label)}
                      className={`rounded-xl border p-3.5 text-left transition ${
                        active
                          ? 'border-gold bg-gold/15 text-paper ring-1 ring-gold/50'
                          : 'border-paper/15 bg-ink-2/70 text-paper/80 hover:border-paper/35'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-paper">
                          {disc.label}
                        </span>
                        <span className="rounded bg-paper/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-gold">
                          {disc.code}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-paper/65">
                        {disc.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field-group">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Coverage Regions in Tanzania *
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedRegions(
                      selectedRegions.length === REGION_NAMES.length
                        ? ['Geita', 'Mwanza', 'Shinyanga']
                        : [...REGION_NAMES],
                    )
                  }
                  className="font-mono text-[10.5px] font-semibold text-gold hover:underline"
                >
                  {selectedRegions.length === REGION_NAMES.length
                    ? 'Reset to Lake Zone'
                    : 'Select All Tanzania Regions'}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {REGION_NAMES.map((reg) => {
                  const selected = selectedRegions.includes(reg);
                  return (
                    <button
                      key={reg}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleRegion(reg)}
                      className={`min-h-[34px] rounded-full border px-2.5 py-1 font-mono text-[11px] transition ${
                        selected
                          ? 'border-gold bg-gold text-ink font-semibold'
                          : 'border-paper/20 bg-ink-2 text-paper/75 hover:border-paper/45'
                      }`}
                    >
                      {reg}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3">
                <label htmlFor="srv-coverage-extra" className="block text-[11px] font-medium text-paper/70">
                  Additional Hubs / Cross-Border Notes (Optional)
                </label>
                <input
                  id="srv-coverage-extra"
                  type="text"
                  value={customCoverage}
                  onChange={(e) => setCustomCoverage(e.target.value)}
                  placeholder="e.g. Mobile camp mobilization nationwide"
                  className="mt-1 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2 text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="srv-equipment" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                Key Equipment / Laboratory Standards
              </label>
              <input
                id="srv-equipment"
                type="text"
                value={equipmentStandards}
                onChange={(e) => setEquipmentStandards(e.target.value)}
                placeholder="e.g. 2x Atlas Copco CS14 diamond rigs, Schramm T450 RC, ICP-MS / Fire Assay 50g"
                className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
              />
            </div>

            <div className="field-group">
              <label htmlFor="srv-description" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                Service Description &amp; Deliverables *
              </label>
              <textarea
                id="srv-description"
                rows={4}
                required
                value={scopeDescription}
                onChange={(e) => setScopeDescription(e.target.value)}
                placeholder="Detail your technical methodology, QA/QC procedures, safety standards, crew capacity, and typical deliverables..."
                className="mt-1.5 w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
              />
              <p className="mt-1 font-mono text-[10.5px] text-paper/55">
                Minimum 20 characters ({scopeDescription.trim().length} entered).
              </p>
            </div>

            <div className="flex justify-end border-t border-paper/12 pt-5">
              <button
                type="button"
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
                className="btn-primary text-xs"
              >
                Continue to Step 2: Rates &amp; Accreditation
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: RATES & ACCREDITATION */}
        {step === 2 && (
          <div className="space-y-6 animate-rise">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="field-group">
                <label htmlFor="srv-pricing-model" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Pricing Model *
                </label>
                <select
                  id="srv-pricing-model"
                  value={pricingModel}
                  onChange={(e) => setPricingModel(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3 py-2.5 text-base text-paper focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                >
                  {SERVICE_PRICING_MODELS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="srv-rate" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Indicative Starting Rate ({rateCurrency})
                </label>
                <div className="mt-1.5 flex gap-2">
                  <select
                    aria-label="Rate currency"
                    value={rateCurrency}
                    disabled={pricingModel === 'RFQ Only'}
                    onChange={(e) => setRateCurrency(e.target.value as 'USD' | 'TZS')}
                    className="min-h-[44px] rounded-lg border border-paper/20 bg-ink-2 px-2.5 py-2 font-mono text-base font-semibold text-gold focus:border-gold focus:outline-none disabled:opacity-45"
                  >
                    <option value="USD">USD</option>
                    <option value="TZS">TZS</option>
                  </select>
                  <input
                    id="srv-rate"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    disabled={pricingModel === 'RFQ Only'}
                    value={pricingModel === 'RFQ Only' ? '' : startingRate}
                    onChange={(e) => setStartingRate(e.target.value)}
                    placeholder={pricingModel === 'RFQ Only' ? 'Quoted per RFQ' : '0'}
                    className="min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 font-mono text-base text-paper tabular-nums placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25 disabled:opacity-45"
                  />
                </div>
                <p className="mt-1 font-mono text-[10.5px] text-paper/55 tabular-nums">
                  {pricingModel === 'RFQ Only'
                    ? 'Clients will submit a custom Request for Quote'
                    : `Approx. ${formatExactUsd(normalizedRateUsd)} (${currency})`}
                </p>
              </div>

              <div className="field-group">
                <label htmlFor="srv-lead-time" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Turnaround / Mobilization Lead Time *
                </label>
                <input
                  id="srv-lead-time"
                  type="text"
                  required
                  value={leadTime}
                  onChange={(e) => setLeadTime(e.target.value)}
                  placeholder="e.g. 5–7 days rig mobilization / 72h assay turnaround"
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                />
              </div>
            </div>

            <div className="field-group">
              <span className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                Accreditations &amp; Regulatory Registrations
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {SERVICE_ACCREDITATIONS.map((acc) => {
                  const checked = selectedAccreditations.includes(acc);
                  return (
                    <button
                      key={acc}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleAccreditation(acc)}
                      className={`flex min-h-[44px] items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left font-mono text-xs font-semibold transition ${
                        checked
                          ? 'border-gold bg-gold text-ink'
                          : 'border-paper/20 bg-ink-2 text-paper/80 hover:border-paper/45'
                      }`}
                    >
                      <span>{acc}</span>
                      {checked && <CheckCircle2 size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="field-group">
                <label htmlFor="srv-cert-notes" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Additional Certifications / Licence Numbers (Optional)
                </label>
                <input
                  id="srv-cert-notes"
                  type="text"
                  value={extraCertNotes}
                  onChange={(e) => setExtraCertNotes(e.target.value)}
                  placeholder="e.g. CRB Class I, OSHA Tanzania, AusIMM / SAIMM"
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                />
              </div>

              <div className="field-group">
                <label htmlFor="srv-portfolio" className="block text-xs font-semibold uppercase tracking-wider text-paper/80">
                  Website / Portfolio Links (Optional, comma-separated)
                </label>
                <input
                  id="srv-portfolio"
                  type="text"
                  value={portfolioLinks}
                  onChange={(e) => setPortfolioLinks(e.target.value)}
                  placeholder="https://yourcompany.co.tz/capabilities"
                  className="mt-1.5 min-h-[44px] w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 text-base text-paper placeholder-paper/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/25"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper/12 pt-5">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-paper/20 bg-paper/10 px-4 py-2 text-xs font-semibold text-paper transition hover:bg-paper/20"
              >
                <ArrowLeft size={14} />
                Back to Step 1
              </button>
              <button
                type="button"
                onClick={() => {
                  if (validateStep2()) setStep(3);
                }}
                className="btn-primary text-xs"
              >
                Continue to Step 3: Credentials, Attachments &amp; Review
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CREDENTIALS, ATTACHMENTS & REVIEW */}
        {step === 3 && (
          <div className="space-y-6 animate-rise">
            <AttachmentSlotGrid
              idPrefix="srv-att"
              slots={SERVICE_ATTACHMENT_SLOTS}
              files={slotFiles}
              errors={slotErrors}
              processing={slotProcessing}
              onFileChange={(slotKey, e) => void handleSlotFileChange(slotKey, e)}
              onRemove={handleRemoveSlotFile}
            />

            {/* Pre-Submission Review Summary */}
            <div className="rounded-xl border border-paper/15 bg-ink-2/90 p-5">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-gold">
                <ClipboardCheck size={14} />
                Review Summary Before Submission
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="font-mono text-[10px] uppercase text-paper/50">Service &amp; Provider</dt>
                  <dd className="mt-0.5 font-semibold text-paper">{serviceName}</dd>
                  <dd className="text-[11px] text-paper/65">{providerOrganization}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-paper/50">Discipline</dt>
                  <dd className="mt-0.5 font-semibold text-gold">{selectedDisciplineSpec.label}</dd>
                  {equipmentStandards && (
                    <dd className="mt-0.5 text-[11px] text-paper/70">{equipmentStandards}</dd>
                  )}
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-paper/50">Coverage Regions</dt>
                  <dd className="mt-0.5 text-paper">{combinedCoverage}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-paper/50">Pricing &amp; Rate</dt>
                  <dd className="mt-0.5 font-mono text-paper tabular-nums">
                    {pricingModel}
                    {pricingModel !== 'RFQ Only'
                      ? ` · ${rateCurrency} ${numericRate.toLocaleString('en-US')}`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-paper/50">Lead Time</dt>
                  <dd className="mt-0.5 text-paper">{leadTime}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase text-paper/50">Accreditations</dt>
                  <dd className="mt-0.5 text-[#9de4b4]">
                    {combinedCertifications || 'Standard Commercial Provider'}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Statutory Compliance Checklist */}
            <div className="space-y-2.5 rounded-xl border border-paper/15 bg-ink-2/70 p-4 text-xs text-paper/85">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-gold">
                <ShieldCheck size={13} />
                Provider Verification &amp; Compliance Declarations
              </div>
              {[
                {
                  id: 'srv-chk-acc',
                  checked: checkAccreditation,
                  onChange: setCheckAccreditation,
                  label:
                    'I confirm all stated accreditations, equipment specifications, and regulatory registrations are accurate and current.',
                },
                {
                  id: 'srv-chk-fee',
                  checked: checkFeeSeparation,
                  onChange: setCheckFeeSeparation,
                  label:
                    'Commercial terms and service contracts are executed directly with clients outside MineConnect.',
                },
                {
                  id: 'srv-chk-guar',
                  checked: checkNoGuarantee,
                  onChange: setCheckNoGuarantee,
                  label:
                    'I understand MineConnect moderates listings for completeness and does not endorse or warrant service outcomes.',
                },
                {
                  id: 'srv-chk-pdpa',
                  checked: checkPdpa,
                  onChange: setCheckPdpa,
                  label:
                    'I consent to Tanzania PDPA-compliant review of uploaded capability profiles and certificates.',
                },
                {
                  id: 'srv-chk-agree',
                  checked: checkServiceListingAgreement,
                  onChange: setCheckServiceListingAgreement,
                  label:
                    'I accept the MineConnect Service Provider Listing Guidelines & Terms of Use.',
                },
              ].map((item) => (
                <label
                  key={item.id}
                  htmlFor={item.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-paper/10 bg-ink/50 p-2.5"
                >
                  <input
                    id={item.id}
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.onChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-ochre"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            {turnstileEnabled && (
              <TurnstileWidget
                ref={turnstileRef}
                theme="dark"
                timeoutMs={8000}
                allowMobileFallback
                fallbackLabel="Verified via signed-in session"
                onVerify={(token) => {
                  setCaptchaToken(token);
                  setCaptchaFallback(false);
                  setError(null);
                }}
                onExpire={() => setCaptchaToken('')}
                onFallbackReady={() => {
                  setCaptchaFallback(true);
                  setError(null);
                }}
                onError={() => setCaptchaFallback(true)}
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper/12 pt-5">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-paper/20 bg-paper/10 px-4 py-2 text-xs font-semibold text-paper transition hover:bg-paper/20"
              >
                <ArrowLeft size={14} />
                Back to Step 2
              </button>
              <button
                type="submit"
                disabled={submitting || anySlotBusy}
                className="btn-primary text-xs disabled:opacity-50"
              >
                {submitting
                  ? 'Uploading Attachments & Publishing...'
                  : 'Submit Service for Admin Verification'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
