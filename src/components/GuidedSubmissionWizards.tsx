import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  FileCheck2,
  MapPin,
  Save,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  createGuidedOpportunitySubmission,
  createGuidedServiceSubmission,
  useAuthSession,
} from '../lib/supabaseAuth';
import { useCurrency } from '../lib/currency';
import { TANZANIA_REGIONS_META } from '../data/tanzaniaRegionsGeoJson';
import type {
  OpportunitySubmissionCategory,
  ServiceExpertiseArea,
  UserOpportunityRecord,
  UserServiceRecord,
} from '../types/database';

const OPPORTUNITY_DRAFT_KEY = 'mineconnect.draft.guided_opportunity.v1';
const SERVICE_DRAFT_KEY = 'mineconnect.draft.guided_service.v1';

const OPPORTUNITY_CATEGORIES: {
  value: OpportunitySubmissionCategory;
  badge: string;
  desc: string;
}[] = [
  {
    value: 'Tender',
    badge: 'PROCUREMENT',
    desc: 'Drilling, haulage, earthworks, laboratory assay, or site catering RFPs',
  },
  {
    value: 'Consultancy',
    badge: 'TECHNICAL',
    desc: 'JORC/NI 43-101 resource modeling, ESIA audits, hydrogeology, or legal',
  },
  {
    value: 'Grant',
    badge: 'FUNDING',
    desc: 'ASM formalization grants, clean processing tech, or exploration co-funding',
  },
  {
    value: 'Internship',
    badge: 'TALENT',
    desc: 'Graduate geologist, metallurgist, mine surveyor, or HSE field placements',
  },
  {
    value: 'Joint Venture',
    badge: 'EARN-IN / JV',
    desc: 'Farm-in, earn-in, or development partner search on active PL/ML tenements',
  },
  {
    value: 'Equipment Supply',
    badge: 'PLANT & FLEET',
    desc: 'Crushing circuits, ball mills, excavators, or XRF analyzers',
  },
];

const SERVICE_EXPERTISE_AREAS: {
  value: ServiceExpertiseArea;
  code: string;
  desc: string;
}[] = [
  {
    value: 'Geological & Exploration',
    code: 'GEO-EXP',
    desc: 'Mapping, geochemistry, drone magnetics, IP geophysics, and JORC/SAMREC',
  },
  {
    value: 'Drilling & Core Recovery',
    code: 'DRL-ops',
    desc: 'Diamond core (HQ/NQ), Reverse Circulation (RC), and grade control',
  },
  {
    value: 'Assay & Laboratory Testing',
    code: 'LAB-ASY',
    desc: 'Fire assay, ICP-MS multi-element, metallurgical bottle-roll & flotation',
  },
  {
    value: 'Legal, Licensing & Cadastre',
    code: 'LEG-CAD',
    desc: 'Mining Commission PL/ML/PML filings, JV agreements, and local content',
  },
  {
    value: 'Environmental (ESIA) & ESG',
    code: 'ENV-ESG',
    desc: 'NEMC ESIA certificates, mine closure plans, and community resettlement',
  },
  {
    value: 'Mine Engineering & EPCM',
    code: 'ENG-EPCM',
    desc: 'Pit optimization, CIL/CIP plant design, tailings storage, and EPCM',
  },
];

const PRICING_MODELS = [
  'Daily Rate (USD / Day)',
  'Per-Metre Drilled (USD / m)',
  'Fixed Milestone / Deliverable Contract',
  'Per Sample / Assay Batch',
  'Monthly Technical Retainer',
];

const REGION_NAMES = Object.keys(TANZANIA_REGIONS_META).sort();

// ============================================================================
// 1. GUIDED OPPORTUNITY SUBMISSION WIZARD (`/dashboard/opportunities`)
// ============================================================================
export function GuidedOpportunityWizard({
  onSubmitted,
}: {
  onSubmitted?: (record: UserOpportunityRecord) => void;
}) {
  const session = useAuthSession();
  const { currency, currencyMeta, formatExactUsd } = useCurrency();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState(
    session?.user.fullName ? `${session.user.fullName} Operations` : ''
  );
  const [category, setCategory] =
    useState<OpportunitySubmissionCategory>('Tender');
  const [location, setLocation] = useState('Geita');
  const [deadline, setDeadline] = useState('2026-12-31');
  const [compensationUsd, setCompensationUsd] = useState('125000');
  const [description, setDescription] = useState('');
  const [requirementsText, setRequirementsText] = useState(
    'Valid Tanzania Mining Commission Local Content Certificate\nTIN & Tax Clearance Certificate\nProven safety & environmental track record'
  );

  // Step 3 Verification Checklist state
  const [checkAuthority, setCheckAuthority] = useState(false);
  const [checkNoUpfrontFee, setCheckNoUpfrontFee] = useState(false);
  const [checkDisclaimer, setCheckDisclaimer] = useState(false);
  const [checkPdpaConsent, setCheckPdpaConsent] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [draftSavedMsg, setDraftSavedMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRecord, setSubmittedRecord] =
    useState<UserOpportunityRecord | null>(null);

  // Hydrate saved draft on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(OPPORTUNITY_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.title) setTitle(draft.title);
        if (draft.organization) setOrganization(draft.organization);
        if (draft.category) setCategory(draft.category);
        if (draft.location) setLocation(draft.location);
        if (draft.deadline) setDeadline(draft.deadline);
        if (draft.compensationUsd !== undefined)
          setCompensationUsd(String(draft.compensationUsd));
        if (draft.description) setDescription(draft.description);
        if (draft.requirementsText)
          setRequirementsText(draft.requirementsText);
      }
    } catch {
      // Ignore malformed draft
    }
  }, []);

  const handleSaveDraft = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      OPPORTUNITY_DRAFT_KEY,
      JSON.stringify({
        title,
        organization,
        category,
        location,
        deadline,
        compensationUsd,
        description,
        requirementsText,
      })
    );
    setDraftSavedMsg('Draft saved to local storage.');
    window.setTimeout(() => setDraftSavedMsg(null), 3500);
  };

  const handleClearDraft = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(OPPORTUNITY_DRAFT_KEY);
    }
    setTitle('');
    setDescription('');
    setCheckAuthority(false);
    setCheckNoUpfrontFee(false);
    setCheckDisclaimer(false);
    setCheckPdpaConsent(false);
    setStep(1);
    setError(null);
  };

  const validateStep1 = (): boolean => {
    if (title.trim().length < 5) {
      setError(
        'Step 1 Validation: Opportunity title must be at least 5 characters.'
      );
      return false;
    }
    if (organization.trim().length < 2) {
      setError(
        'Step 1 Validation: Issuing organization or company name is required.'
      );
      return false;
    }
    setError(null);
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!location) {
      setError('Step 2 Validation: Please select a Tanzanian Region (Mkoa).');
      return false;
    }
    if (!deadline) {
      setError('Step 2 Validation: Please specify a valid closing deadline.');
      return false;
    }
    if (description.trim().length < 20) {
      setError(
        'Step 2 Validation: Please provide a technical scope description of at least 20 characters.'
      );
      return false;
    }
    setError(null);
    return true;
  };

  const allChecksComplete =
    checkAuthority && checkNoUpfrontFee && checkDisclaimer && checkPdpaConsent;

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2()) return;
    if (!allChecksComplete) {
      setError(
        'Step 3 Validation: Please confirm all four verification & compliance guidelines before publishing.'
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

      const res = await createGuidedOpportunitySubmission({
        title,
        organization,
        category,
        location,
        deadline,
        compensationUsd: Number(compensationUsd) || 0,
        description,
        requirements,
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
    }
  };

  const parsedBudget = Math.max(0, Number(compensationUsd) || 0);
  const parsedRequirements = requirementsText
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);

  if (submittedRecord) {
    return (
      <div className="grain relative overflow-hidden rounded-2xl border border-gold/40 bg-ink p-8 text-paper shadow-2xl">
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
            <strong className="text-paper">
              &ldquo;{submittedRecord.title}&rdquo;
            </strong>{' '}
            has been written to <code className="font-mono text-gold">public.opportunities</code> with{' '}
            <code className="font-mono text-gold">status = &apos;pending&apos;</code> and logged in{' '}
            <code className="font-mono text-gold">public.audit_logs</code> (action:{' '}
            <code className="font-mono text-gold">CREATE_OPPORTUNITY</code>).
          </p>

          <div className="grid gap-3 rounded-xl border border-paper/12 bg-ink-2/90 p-5 font-mono text-xs sm:grid-cols-3">
            <div>
              <div className="text-[10px] uppercase text-paper/50">
                Reference Code
              </div>
              <div className="mt-0.5 font-bold text-gold">
                {submittedRecord.reference_code}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-paper/50">
                Category &amp; Region
              </div>
              <div className="mt-0.5 text-paper">
                {submittedRecord.category} · Mkoa wa {submittedRecord.location}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-paper/50">
                Moderation Status
              </div>
              <div className="mt-0.5 text-gold">
                PENDING ADMIN REVIEW (/admin/approvals)
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setSubmittedRecord(null);
                handleClearDraft();
              }}
              className="btn-primary !py-2.5 !px-5 text-xs"
            >
              + Publish Another Opportunity
            </button>
            <Link
              to="/admin/approvals"
              className="inline-flex items-center gap-1.5 rounded-md border border-gold/45 bg-moss/30 px-4 py-2.5 text-xs font-semibold text-gold transition hover:bg-moss/45"
            >
              <ClipboardCheck size={14} />
              Inspect in Admin Approvals Queue →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grain relative overflow-hidden rounded-2xl border border-gold/30 bg-ink text-paper shadow-2xl">
      <div className="contours absolute inset-0" aria-hidden="true" />

      {/* Top Wizard Header & Stepper Bar */}
      <div className="relative border-b border-paper/12 bg-ink-2/90 px-6 py-5 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
              <Sparkles size={12} />
              Guided Publishing Workflow · `public.opportunities`
            </span>
            <h2 className="font-display mt-1 text-2xl font-light text-paper sm:text-3xl">
              Publish Mining{' '}
              <em className="italic text-gold">Opportunity, Tender or Grant</em>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-ink px-3 py-1.5 font-mono text-[11px] text-gold transition hover:bg-ochre/25"
            >
              <Save size={12} />
              Save Draft
            </button>
            <button
              type="button"
              onClick={handleClearDraft}
              className="rounded-lg border border-paper/15 bg-paper/5 px-3 py-1.5 font-mono text-[11px] text-paper/70 transition hover:text-paper"
            >
              Reset
            </button>
          </div>
        </div>

        {/* 3-Step Progress Stepper */}
        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {(
            [
              [1, 'Step 01 · General Info', 'Title, Organization & Category'],
              [2, 'Step 02 · Scope & Execution', 'Mkoa, Deadline, Budget & Specs'],
              [3, 'Step 03 · Verification & Preview', 'Compliance Checklist & Publish'],
            ] as const
          ).map(([num, label, sub]) => {
            const active = step === num;
            const completed = step > num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => {
                  if (num === 1) setStep(1);
                  if (num === 2 && validateStep1()) setStep(2);
                  if (num === 3 && validateStep1() && validateStep2())
                    setStep(3);
                }}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-gold bg-ochre/25 text-paper shadow-md'
                    : completed
                      ? 'border-moss/50 bg-moss/20 text-paper/90'
                      : 'border-paper/10 bg-ink/60 text-paper/55 hover:border-paper/25'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
                    active
                      ? 'bg-gold text-ink'
                      : completed
                        ? 'bg-moss text-paper'
                        : 'bg-paper/10 text-paper/60'
                  }`}
                >
                  {completed ? '✓' : num}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-mono text-[11px] font-semibold uppercase tracking-wider text-gold">
                    {label}
                  </div>
                  <div className="truncate text-[11px] text-paper/70">{sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Wizard Form Body */}
      <form onSubmit={handleFinalSubmit} className="relative p-6 lg:p-8">
        {error && (
          <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-danger/45 bg-danger/15 px-4 py-3 text-xs font-medium text-paper">
            <AlertCircle size={16} className="shrink-0 text-gold" />
            <span>{error}</span>
          </div>
        )}

        {draftSavedMsg && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-gold/40 bg-moss/30 px-4 py-2.5 font-mono text-xs text-gold">
            <CheckCircle2 size={14} />
            <span>{draftSavedMsg}</span>
          </div>
        )}

        {/* STEP 1: GENERAL INFORMATION */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gold">
                  Opportunity / Tender Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., 3,000m Diamond Core Drilling RFP — Geita Shear Zone"
                  className="w-full rounded-lg border border-paper/20 bg-ink-2 px-4 py-2.5 text-sm text-paper outline-none transition placeholder:text-paper/35 focus:border-gold"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gold">
                  Issuing Organization / Licence Holder *
                </label>
                <input
                  type="text"
                  required
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g., Lake Victoria Goldfields Ltd"
                  className="w-full rounded-lg border border-paper/20 bg-ink-2 px-4 py-2.5 text-sm text-paper outline-none transition placeholder:text-paper/35 focus:border-gold"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-gold">
                Select Opportunity Category *
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {OPPORTUNITY_CATEGORIES.map((cat) => {
                  const selected = category === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`flex flex-col justify-between rounded-xl border p-4 text-left transition ${
                        selected
                          ? 'border-gold bg-ochre/25 shadow-lg'
                          : 'border-paper/12 bg-ink-2/80 hover:border-gold/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-lg font-medium text-paper">
                            {cat.value}
                          </span>
                          <span className="rounded bg-ink px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-gold">
                            {cat.badge}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-paper/65">
                          {cat.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end border-t border-paper/12 pt-5">
              <button
                type="button"
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
                className="btn-primary !py-2.5 !px-6 text-xs"
              >
                Continue to Step 02: Scope &amp; Execution{' '}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SCOPE & EXECUTION DETAILS */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gold">
                  Regional Location (Mkoa) *
                </label>
                <div className="relative">
                  <MapPin
                    size={14}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gold"
                  />
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-lg border border-paper/20 bg-ink-2 py-2.5 pl-9 pr-3 text-sm text-paper outline-none focus:border-gold"
                  >
                    {REGION_NAMES.map((r) => (
                      <option key={r} value={r}>
                        Mkoa wa {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gold">
                  Submission Deadline *
                </label>
                <div className="relative">
                  <Calendar
                    size={14}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gold"
                  />
                  <input
                    type="date"
                    required
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full rounded-lg border border-paper/20 bg-ink-2 py-2.5 pl-9 pr-3 font-mono text-sm text-paper outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gold">
                  Indicative Value / Budget (USD)
                </label>
                <div className="relative">
                  <Coins
                    size={14}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gold"
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={compensationUsd}
                    onChange={(e) => setCompensationUsd(e.target.value)}
                    className="w-full rounded-lg border border-paper/20 bg-ink-2 py-2.5 pl-9 pr-3 font-mono text-sm text-paper outline-none focus:border-gold"
                  />
                </div>
                <p className="mt-1 font-mono text-[10px] text-gold">
                  Converted ({currencyMeta.flag} {currency}):{' '}
                  {formatExactUsd(parsedBudget)}
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gold">
                Detailed Technical Scope &amp; Deliverables *
              </label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe technical specifications, site access, geological context, mobilization window, and evaluation criteria..."
                className="w-full rounded-lg border border-paper/20 bg-ink-2 p-3.5 text-sm text-paper outline-none placeholder:text-paper/35 focus:border-gold"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gold">
                Bidder / Applicant Qualification Requirements (One per line)
              </label>
              <textarea
                rows={3}
                value={requirementsText}
                onChange={(e) => setRequirementsText(e.target.value)}
                placeholder="Valid Tanzania Mining Commission Local Content Compliance Certificate&#10;ISO / OSHA safety documentation"
                className="w-full rounded-lg border border-paper/20 bg-ink-2 p-3.5 font-mono text-xs text-paper outline-none placeholder:text-paper/35 focus:border-gold"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper/12 pt-5">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-paper/20 bg-paper/5 px-4 py-2.5 text-xs font-semibold text-paper transition hover:bg-paper/15"
              >
                <ArrowLeft size={14} />
                Back to Step 01
              </button>
              <button
                type="button"
                onClick={() => {
                  if (validateStep2()) setStep(3);
                }}
                className="btn-primary !py-2.5 !px-6 text-xs"
              >
                Continue to Step 03: Verification &amp; Preview{' '}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: VERIFICATION CHECKLIST & INSTANT PREVIEW */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Left: Mandatory Verification & Listing Guidelines Checklist */}
              <div className="space-y-3 rounded-xl border border-gold/30 bg-ink-2/90 p-5">
                <div className="flex items-center gap-2 text-gold">
                  <FileCheck2 size={18} />
                  <h3 className="font-display text-lg font-medium text-paper">
                    Verification &amp; Publishing Guidelines Checklist
                  </h3>
                </div>
                <p className="text-xs text-paper/65">
                  Mirroring MineConnect&apos;s project-listing standards, every submission must pass these four statutory and anti-fraud checks before entering the Admin Approval Queue:
                </p>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-paper/10 bg-ink/70 p-3 text-xs transition hover:border-gold/40">
                  <input
                    type="checkbox"
                    checked={checkAuthority}
                    onChange={(e) => setCheckAuthority(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-ochre"
                  />
                  <span>
                    <strong className="text-gold">
                      1. Corporate &amp; Tenement Authority:
                    </strong>{' '}
                    I confirm that {organization || 'the issuing organization'}{' '}
                    holds valid corporate registration or mineral right authorization in Tanzania for this scope.
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-paper/10 bg-ink/70 p-3 text-xs transition hover:border-gold/40">
                  <input
                    type="checkbox"
                    checked={checkNoUpfrontFee}
                    onChange={(e) => setCheckNoUpfrontFee(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-ochre"
                  />
                  <span>
                    <strong className="text-gold">
                      2. Zero Upfront Application / Tender Fees:
                    </strong>{' '}
                    No informal cash, mobile-money, or unreceipted fee is solicited from applicants outside statutory government channels.
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-paper/10 bg-ink/70 p-3 text-xs transition hover:border-gold/40">
                  <input
                    type="checkbox"
                    checked={checkDisclaimer}
                    onChange={(e) => setCheckDisclaimer(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-ochre"
                  />
                  <span>
                    <strong className="text-gold">
                      3. Regulatory &amp; Assay Disclaimer:
                    </strong>{' '}
                    I acknowledge MineConnect is a marketplace and not a licensing authority; all statutory approvals remain subject to the Tanzania Mining Commission.
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-paper/10 bg-ink/70 p-3 text-xs transition hover:border-gold/40">
                  <input
                    type="checkbox"
                    checked={checkPdpaConsent}
                    onChange={(e) => setCheckPdpaConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-ochre"
                  />
                  <span>
                    <strong className="text-gold">
                      4. PDPA 2022 &amp; Audit Trail Consent:
                    </strong>{' '}
                    I consent to recording this submission under{' '}
                    <code className="font-mono text-gold">
                      auth.uid() = user_id
                    </code>{' '}
                    and logging an immutable event in{' '}
                    <code className="font-mono text-gold">public.audit_logs</code>.
                  </span>
                </label>
              </div>

              {/* Right: Live Formatted Parchment Preview Dossier */}
              <div className="rounded-xl border border-sand/50 bg-paper p-5 text-ink shadow-xl">
                <div className="flex items-center justify-between border-b border-ink/10 pb-3">
                  <span className="rounded bg-ink px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-gold">
                    LIVE PREVIEW · {category.toUpperCase()}
                  </span>
                  <span className="rounded border border-gold/50 bg-gold/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-ochre">
                    STATUS: PENDING ADMIN REVIEW
                  </span>
                </div>

                <h4 className="font-display mt-3 text-xl font-semibold text-ink">
                  {title || 'Untitled Opportunity'}
                </h4>
                <p className="mt-1 font-mono text-xs text-ochre">
                  {organization || 'Organization'} · Mkoa wa {location} · Closes{' '}
                  {deadline}
                </p>

                <div className="mt-3 rounded-lg border border-ink/10 bg-paper-2 p-3 font-mono text-xs">
                  <span className="text-stone">Indicative Contract Value:</span>{' '}
                  <strong className="text-ink">
                    ${parsedBudget.toLocaleString('en-US')} USD
                  </strong>{' '}
                  <span className="text-ochre">
                    ({formatExactUsd(parsedBudget)})
                  </span>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-ink-3">
                  {description || 'No description entered yet.'}
                </p>

                {parsedRequirements.length > 0 && (
                  <div className="mt-3 border-t border-ink/10 pt-3">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-stone">
                      Qualification Requirements ({parsedRequirements.length})
                    </div>
                    <ul className="mt-1.5 space-y-1 text-xs text-ink">
                      {parsedRequirements.map((req, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <CheckCircle2
                            size={13}
                            className="mt-0.5 shrink-0 text-moss"
                          />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper/12 pt-5">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-paper/20 bg-paper/5 px-4 py-2.5 text-xs font-semibold text-paper transition hover:bg-paper/15"
              >
                <ArrowLeft size={14} />
                Back to Step 02
              </button>

              <button
                type="submit"
                disabled={submitting || !allChecksComplete}
                className="btn-primary !py-3 !px-7 text-xs disabled:opacity-45"
              >
                <ShieldCheck size={15} />
                {submitting
                  ? 'Validating & Logging to Audit Trail...'
                  : 'Submit Opportunity for Admin Approval'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

// ============================================================================
// 2. GUIDED PROFESSIONAL SERVICE SUBMISSION WIZARD (`/dashboard/services`)
// ============================================================================
export function GuidedServiceWizard({
  onSubmitted,
}: {
  onSubmitted?: (record: UserServiceRecord) => void;
}) {
  const session = useAuthSession();
  const { currency, currencyMeta, formatExactUsd } = useCurrency();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [serviceName, setServiceName] = useState('');
  const [providerOrganization, setProviderOrganization] = useState(
    session?.user.fullName ? `${session.user.fullName} GeoServices Ltd` : ''
  );
  const [expertiseArea, setExpertiseArea] = useState<ServiceExpertiseArea>(
    'Geological & Exploration'
  );
  const [regionalCoverage, setRegionalCoverage] = useState(
    'Geita, Mwanza, Shinyanga, Dodoma, Lindi'
  );
  const [rateOrPricingModel, setRateOrPricingModel] = useState(
    PRICING_MODELS[0]
  );
  const [estimatedRateUsd, setEstimatedRateUsd] = useState('1450');
  const [scopeDescription, setScopeDescription] = useState('');
  const [portfolioLinks, setPortfolioLinks] = useState('');
  const [certifications, setCertifications] = useState(
    'ERB / CRB Registered · Tanzania Mining Commission Approved Local Service Provider'
  );

  // Step 3 Verification Checklist state
  const [checkAccreditation, setCheckAccreditation] = useState(false);
  const [checkFeeSeparation, setCheckFeeSeparation] = useState(false);
  const [checkNoGuarantee, setCheckNoGuarantee] = useState(false);
  const [checkPdpa, setCheckPdpa] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [draftSavedMsg, setDraftSavedMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRecord, setSubmittedRecord] =
    useState<UserServiceRecord | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SERVICE_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.serviceName) setServiceName(draft.serviceName);
        if (draft.providerOrganization)
          setProviderOrganization(draft.providerOrganization);
        if (draft.expertiseArea) setExpertiseArea(draft.expertiseArea);
        if (draft.regionalCoverage) setRegionalCoverage(draft.regionalCoverage);
        if (draft.rateOrPricingModel)
          setRateOrPricingModel(draft.rateOrPricingModel);
        if (draft.estimatedRateUsd !== undefined)
          setEstimatedRateUsd(String(draft.estimatedRateUsd));
        if (draft.scopeDescription) setScopeDescription(draft.scopeDescription);
        if (draft.portfolioLinks) setPortfolioLinks(draft.portfolioLinks);
        if (draft.certifications) setCertifications(draft.certifications);
      }
    } catch {
      // Ignore malformed draft
    }
  }, []);

  const handleSaveDraft = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      SERVICE_DRAFT_KEY,
      JSON.stringify({
        serviceName,
        providerOrganization,
        expertiseArea,
        regionalCoverage,
        rateOrPricingModel,
        estimatedRateUsd,
        scopeDescription,
        portfolioLinks,
        certifications,
      })
    );
    setDraftSavedMsg('Service draft saved locally.');
    window.setTimeout(() => setDraftSavedMsg(null), 3500);
  };

  const handleClearDraft = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SERVICE_DRAFT_KEY);
    }
    setServiceName('');
    setScopeDescription('');
    setPortfolioLinks('');
    setCheckAccreditation(false);
    setCheckFeeSeparation(false);
    setCheckNoGuarantee(false);
    setCheckPdpa(false);
    setStep(1);
    setError(null);
  };

  const validateStep1 = (): boolean => {
    if (serviceName.trim().length < 5) {
      setError(
        'Step 1 Validation: Service name must be at least 5 characters.'
      );
      return false;
    }
    if (providerOrganization.trim().length < 2) {
      setError(
        'Step 1 Validation: Provider firm or organization name is required.'
      );
      return false;
    }
    setError(null);
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!rateOrPricingModel.trim()) {
      setError('Step 2 Validation: Please select or enter a pricing model.');
      return false;
    }
    if (scopeDescription.trim().length < 20) {
      setError(
        'Step 2 Validation: Technical scope description must be at least 20 characters.'
      );
      return false;
    }
    setError(null);
    return true;
  };

  const allChecksComplete =
    checkAccreditation && checkFeeSeparation && checkNoGuarantee && checkPdpa;

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2()) return;
    if (!allChecksComplete) {
      setError(
        'Step 3 Validation: Please confirm all four professional service verification guidelines before publishing.'
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await createGuidedServiceSubmission({
        serviceName,
        providerOrganization,
        expertiseArea,
        regionalCoverage,
        rateOrPricingModel,
        estimatedRateUsd: Number(estimatedRateUsd) || 0,
        scopeDescription,
        portfolioLinks,
        certifications,
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
    }
  };

  const parsedRate = Math.max(0, Number(estimatedRateUsd) || 0);

  if (submittedRecord) {
    return (
      <div className="grain relative overflow-hidden rounded-2xl border border-gold/40 bg-ink p-8 text-paper shadow-2xl">
        <div className="contours absolute inset-0" aria-hidden="true" />
        <div className="relative space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-moss/30 px-3.5 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-gold">
            <CheckCircle2 size={14} />
            Service Listing Queued · Reference {submittedRecord.reference_code}
          </div>

          <h3 className="font-display text-3xl font-light text-paper">
            Service Profile Submitted for{' '}
            <em className="italic text-gold">Administrative Verification</em>
          </h3>

          <p className="max-w-2xl text-sm leading-relaxed text-paper/75">
            Your service{' '}
            <strong className="text-paper">
              &ldquo;{submittedRecord.service_name}&rdquo;
            </strong>{' '}
            has been written to <code className="font-mono text-gold">public.services</code> with{' '}
            <code className="font-mono text-gold">status = &apos;pending&apos;</code> and logged in{' '}
            <code className="font-mono text-gold">public.audit_logs</code> (action:{' '}
            <code className="font-mono text-gold">CREATE_SERVICE</code>).
          </p>

          <div className="grid gap-3 rounded-xl border border-paper/12 bg-ink-2/90 p-5 font-mono text-xs sm:grid-cols-3">
            <div>
              <div className="text-[10px] uppercase text-paper/50">
                Reference Code
              </div>
              <div className="mt-0.5 font-bold text-gold">
                {submittedRecord.reference_code}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-paper/50">
                Expertise &amp; Pricing
              </div>
              <div className="mt-0.5 text-paper">
                {submittedRecord.expertise_area} ·{' '}
                {submittedRecord.rate_or_pricing_model}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-paper/50">
                Moderation Status
              </div>
              <div className="mt-0.5 text-gold">
                PENDING ADMIN REVIEW (/admin/approvals)
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setSubmittedRecord(null);
                handleClearDraft();
              }}
              className="btn-primary !py-2.5 !px-5 text-xs"
            >
              + Publish Another Service
            </button>
            <Link
              to="/admin/approvals"
              className="inline-flex items-center gap-1.5 rounded-md border border-gold/45 bg-moss/30 px-4 py-2.5 text-xs font-semibold text-gold transition hover:bg-moss/45"
            >
              <ClipboardCheck size={14} />
              Inspect in Admin Approvals Queue →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grain relative overflow-hidden rounded-2xl border border-gold/30 bg-ink text-paper shadow-2xl">
      <div className="contours absolute inset-0" aria-hidden="true" />

      {/* Top Wizard Header & Stepper Bar */}
      <div className="relative border-b border-paper/12 bg-ink-2/90 px-6 py-5 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
              <Wrench size={12} />
              Guided Publishing Workflow · `public.services`
            </span>
            <h2 className="font-display mt-1 text-2xl font-light text-paper sm:text-3xl">
              Publish Verified{' '}
              <em className="italic text-gold">Technical &amp; Mining Service</em>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-ink px-3 py-1.5 font-mono text-[11px] text-gold transition hover:bg-ochre/25"
            >
              <Save size={12} />
              Save Draft
            </button>
            <button
              type="button"
              onClick={handleClearDraft}
              className="rounded-lg border border-paper/15 bg-paper/5 px-3 py-1.5 font-mono text-[11px] text-paper/70 transition hover:text-paper"
            >
              Reset
            </button>
          </div>
        </div>

        {/* 3-Step Progress Stepper */}
        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {(
            [
              [
                1,
                'Step 01 · Provider & Expertise',
                'Service Title, Firm & Discipline',
              ],
              [
                2,
                'Step 02 · Rates & Technical Scope',
                'Pricing Model, Deliverables & Links',
              ],
              [
                3,
                'Step 03 · Verification & Preview',
                'Accreditation Checklist & Publish',
              ],
            ] as const
          ).map(([num, label, sub]) => {
            const active = step === num;
            const completed = step > num;
            return (
              <button
                key={num}
                type="button"
                onClick={() => {
                  if (num === 1) setStep(1);
                  if (num === 2 && validateStep1()) setStep(2);
                  if (num === 3 && validateStep1() && validateStep2())
                    setStep(3);
                }}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-gold bg-ochre/25 text-paper shadow-md'
                    : completed
                      ? 'border-moss/50 bg-moss/20 text-paper/90'
                      : 'border-paper/10 bg-ink/60 text-paper/55 hover:border-paper/25'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
                    active
                      ? 'bg-gold text-ink'
                      : completed
                        ? 'bg-moss text-paper'
                        : 'bg-paper/10 text-paper/60'
                  }`}
                >
                  {completed ? '✓' : num}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-mono text-[11px] font-semibold uppercase tracking-wider text-gold">
                    {label}
                  </div>
                  <div className="truncate text-[11px] text-paper/70">{sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Wizard Form Body */}
      <form onSubmit={handleFinalSubmit} className="relative p-6 lg:p-8">
        {error && (
          <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-danger/45 bg-danger/15 px-4 py-3 text-xs font-medium text-paper">
            <AlertCircle size={16} className="shrink-0 text-gold" />
            <span>{error}</span>
          </div>
        )}

        {draftSavedMsg && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-gold/40 bg-moss/30 px-4 py-2.5 font-mono text-xs text-gold">
            <CheckCircle2 size={14} />
            <span>{draftSavedMsg}</span>
          </div>
        )}

        {/* STEP 1: GENERAL INFORMATION */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gold">
                  Professional Service Name *
                </label>
                <input
                  type="text"
                  required
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="e.g., Diamond Core Drilling (HQ/NQ) & Downhole Orientation"
                  className="w-full rounded-lg border border-paper/20 bg-ink-2 px-4 py-2.5 text-sm text-paper outline-none transition placeholder:text-paper/35 focus:border-gold"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gold">
                  Provider Firm / Organization *
                </label>
                <input
                  type="text"
                  required
                  value={providerOrganization}
                  onChange={(e) => setProviderOrganization(e.target.value)}
                  placeholder="e.g., East African GeoDrilling & Assay Ltd"
                  className="w-full rounded-lg border border-paper/20 bg-ink-2 px-4 py-2.5 text-sm text-paper outline-none transition placeholder:text-paper/35 focus:border-gold"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-gold">
                Primary Technical Expertise Area *
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SERVICE_EXPERTISE_AREAS.map((area) => {
                  const selected = expertiseArea === area.value;
                  return (
                    <button
                      key={area.value}
                      type="button"
                      onClick={() => setExpertiseArea(area.value)}
                      className={`flex flex-col justify-between rounded-xl border p-4 text-left transition ${
                        selected
                          ? 'border-gold bg-ochre/25 shadow-lg'
                          : 'border-paper/12 bg-ink-2/80 hover:border-gold/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-base font-medium text-paper">
                            {area.value}
                          </span>
                          <span className="rounded bg-ink px-2 py-0.5 font-mono text-[9px] uppercase text-gold">
                            {area.code}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-paper/65">
                          {area.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gold">
                Regional Operational Coverage (Mikoa)
              </label>
              <input
                type="text"
                value={regionalCoverage}
                onChange={(e) => setRegionalCoverage(e.target.value)}
                placeholder="e.g., Geita, Mwanza, Shinyanga, Dodoma, Manyara"
                className="w-full rounded-lg border border-paper/20 bg-ink-2 px-4 py-2.5 text-sm text-paper outline-none focus:border-gold"
              />
            </div>

            <div className="flex justify-end border-t border-paper/12 pt-5">
              <button
                type="button"
                onClick={() => {
                  if (validateStep1()) setStep(2);
                }}
                className="btn-primary !py-2.5 !px-6 text-xs"
              >
                Continue to Step 02: Rates &amp; Scope <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SCOPE & EXECUTION DETAILS */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gold">
                  Commercial Rate or Pricing Model *
                </label>
                <select
                  value={rateOrPricingModel}
                  onChange={(e) => setRateOrPricingModel(e.target.value)}
                  className="w-full rounded-lg border border-paper/20 bg-ink-2 px-3.5 py-2.5 text-sm text-paper outline-none focus:border-gold"
                >
                  {PRICING_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gold">
                  Indicative Baseline Rate (USD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={estimatedRateUsd}
                  onChange={(e) => setEstimatedRateUsd(e.target.value)}
                  className="w-full rounded-lg border border-paper/20 bg-ink-2 px-4 py-2.5 font-mono text-sm text-paper outline-none focus:border-gold"
                />
                <p className="mt-1 font-mono text-[10px] text-gold">
                  Converted ({currencyMeta.flag} {currency}):{' '}
                  {formatExactUsd(parsedRate)}
                </p>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gold">
                Detailed Technical Scope, Equipment &amp; Deliverables *
              </label>
              <textarea
                rows={4}
                required
                value={scopeDescription}
                onChange={(e) => setScopeDescription(e.target.value)}
                placeholder="Detail your equipment fleet, laboratory QA/QC protocols, turnaround times, and technical deliverables..."
                className="w-full rounded-lg border border-paper/20 bg-ink-2 p-3.5 text-sm text-paper outline-none placeholder:text-paper/35 focus:border-gold"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gold">
                  Professional Certifications &amp; Registrations
                </label>
                <input
                  type="text"
                  value={certifications}
                  onChange={(e) => setCertifications(e.target.value)}
                  placeholder="e.g., ERB, CRB, ISO/IEC 17025, AusIMM CP"
                  className="w-full rounded-lg border border-paper/20 bg-ink-2 px-4 py-2.5 text-xs text-paper outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-gold">
                  Portfolio / Technical Capability Dossier URL
                </label>
                <input
                  type="text"
                  value={portfolioLinks}
                  onChange={(e) => setPortfolioLinks(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-paper/20 bg-ink-2 px-4 py-2.5 font-mono text-xs text-paper outline-none focus:border-gold"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper/12 pt-5">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-paper/20 bg-paper/5 px-4 py-2.5 text-xs font-semibold text-paper transition hover:bg-paper/15"
              >
                <ArrowLeft size={14} />
                Back to Step 01
              </button>
              <button
                type="button"
                onClick={() => {
                  if (validateStep2()) setStep(3);
                }}
                className="btn-primary !py-2.5 !px-6 text-xs"
              >
                Continue to Step 03: Verification &amp; Preview{' '}
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: VERIFICATION CHECKLIST & INSTANT PREVIEW */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Left: Service Verification & Compliance Checklist */}
              <div className="space-y-3 rounded-xl border border-gold/30 bg-ink-2/90 p-5">
                <div className="flex items-center gap-2 text-gold">
                  <FileCheck2 size={18} />
                  <h3 className="font-display text-lg font-medium text-paper">
                    Service Provider Verification Checklist
                  </h3>
                </div>
                <p className="text-xs text-paper/65">
                  Confirm all four regulatory and commercial transparency standards before submitting to the Admin Approval Queue:
                </p>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-paper/10 bg-ink/70 p-3 text-xs transition hover:border-gold/40">
                  <input
                    type="checkbox"
                    checked={checkAccreditation}
                    onChange={(e) => setCheckAccreditation(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-ochre"
                  />
                  <span>
                    <strong className="text-gold">
                      1. Valid Professional Accreditation:
                    </strong>{' '}
                    Our firm holds valid statutory registration (BRELA, TRA TIN, ERB/CRB, or Tanzania Mining Commission Local Content registration) for this discipline.
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-paper/10 bg-ink/70 p-3 text-xs transition hover:border-gold/40">
                  <input
                    type="checkbox"
                    checked={checkFeeSeparation}
                    onChange={(e) => setCheckFeeSeparation(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-ochre"
                  />
                  <span>
                    <strong className="text-gold">
                      2. Separation of Commercial &amp; Government Fees:
                    </strong>{' '}
                    All quoted commercial rates are clearly separated from statutory government application, royalty, or assay fees.
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-paper/10 bg-ink/70 p-3 text-xs transition hover:border-gold/40">
                  <input
                    type="checkbox"
                    checked={checkNoGuarantee}
                    onChange={(e) => setCheckNoGuarantee(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-ochre"
                  />
                  <span>
                    <strong className="text-gold">
                      3. Independent Technical Objectivity:
                    </strong>{' '}
                    We do not guarantee licence approval, mineral grade, or commercial profitability in violation of JORC/SAMREC ethics.
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-paper/10 bg-ink/70 p-3 text-xs transition hover:border-gold/40">
                  <input
                    type="checkbox"
                    checked={checkPdpa}
                    onChange={(e) => setCheckPdpa(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-ochre"
                  />
                  <span>
                    <strong className="text-gold">
                      4. PDPA 2022 &amp; Audit Trail Consent:
                    </strong>{' '}
                    I consent to binding this service profile to{' '}
                    <code className="font-mono text-gold">
                      auth.uid() = user_id
                    </code>{' '}
                    and recording an immutable audit event.
                  </span>
                </label>
              </div>

              {/* Right: Live Formatted Parchment Preview Dossier */}
              <div className="rounded-xl border border-sand/50 bg-paper p-5 text-ink shadow-xl">
                <div className="flex items-center justify-between border-b border-ink/10 pb-3">
                  <span className="rounded bg-ink px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-gold">
                    LIVE PREVIEW · {expertiseArea}
                  </span>
                  <span className="rounded border border-gold/50 bg-gold/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-ochre">
                    STATUS: PENDING ADMIN REVIEW
                  </span>
                </div>

                <h4 className="font-display mt-3 text-xl font-semibold text-ink">
                  {serviceName || 'Untitled Professional Service'}
                </h4>
                <p className="mt-1 font-mono text-xs text-ochre">
                  {providerOrganization || 'Provider Firm'} · Coverage:{' '}
                  {regionalCoverage}
                </p>

                <div className="mt-3 rounded-lg border border-ink/10 bg-paper-2 p-3 font-mono text-xs">
                  <span className="text-stone">{rateOrPricingModel}:</span>{' '}
                  <strong className="text-ink">
                    ${parsedRate.toLocaleString('en-US')} USD
                  </strong>{' '}
                  <span className="text-ochre">
                    ({formatExactUsd(parsedRate)})
                  </span>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-ink-3">
                  {scopeDescription || 'No technical scope entered yet.'}
                </p>

                {certifications && (
                  <div className="mt-3 border-t border-ink/10 pt-2.5 font-mono text-[11px] text-moss">
                    Accreditations: {certifications}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper/12 pt-5">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-paper/20 bg-paper/5 px-4 py-2.5 text-xs font-semibold text-paper transition hover:bg-paper/15"
              >
                <ArrowLeft size={14} />
                Back to Step 02
              </button>

              <button
                type="submit"
                disabled={submitting || !allChecksComplete}
                className="btn-primary !py-3 !px-7 text-xs disabled:opacity-45"
              >
                <Briefcase size={15} />
                {submitting
                  ? 'Validating & Logging to Audit Trail...'
                  : 'Submit Service for Admin Approval'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
