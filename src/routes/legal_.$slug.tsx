import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Scale,
  Send,
  ShieldCheck,
} from 'lucide-react'
import {
  LEGAL_DOCUMENTS,
  LEGAL_DOCUMENTS_BY_SLUG,
  isLegalDocumentSlug,
  type LegalDocumentSlug,
} from '../data/legalDocuments'
import TurnstileWidget, {
  isTurnstileEnabled,
  type TurnstileWidgetHandle,
} from '../components/TurnstileWidget'
import { submitComplianceComplaint, useAuthSession } from '../lib/supabaseAuth'
import { verifyTurnstileForForm } from '../lib/verifyTurnstileClient'
import type { ComplianceComplaintCategory } from '../types/database'

const COMPLAINT_CATEGORIES: ComplianceComplaintCategory[] = [
  'Unverified License',
  'Misleading Claim',
  'Fee Circumvention',
  'Privacy',
  'Other',
]

export const Route = createFileRoute('/legal_/$slug')({
  head: ({ params }) => {
    const doc = isLegalDocumentSlug(params.slug)
      ? LEGAL_DOCUMENTS_BY_SLUG[params.slug]
      : LEGAL_DOCUMENTS[0]
    return {
      meta: [{ title: `${doc.title} — MineConnect Legal Center` }],
    }
  },
  component: LegalDocumentPage,
})

function LegalDocumentPage() {
  const { slug } = Route.useParams()
  const activeSlug: LegalDocumentSlug = isLegalDocumentSlug(slug)
    ? slug
    : 'terms-of-use'
  const doc = LEGAL_DOCUMENTS_BY_SLUG[activeSlug]

  // Scroll smoothly to top whenever the active legal document changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [activeSlug])

  return (
    <div className="min-h-screen bg-paper pb-24 pt-[72px] text-ink">
      {/* Classic Editorial Legal Masthead */}
      <section className="border-b border-ink/12 bg-ink text-paper">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-16">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/35 bg-ochre/20 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
              <Scale size={12} />
              Mine Connect Legal &amp; Compliance Center
            </span>
            <span className="rounded-full border border-paper/15 bg-paper/5 px-3 py-1 font-mono text-[11px] text-paper/80">
              {doc.category}
            </span>
          </div>

          <h1 className="mt-4 font-display text-4xl font-light leading-tight text-paper md:text-5xl">
            {doc.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-paper/75 sm:text-base">
            {doc.summary}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-5 border-t border-paper/12 pt-5 font-mono text-xs text-paper/70">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={13} className="text-gold" />
              Effective Date: <strong className="text-paper">{doc.effectiveDate}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-gold" />
              Jurisdiction: <strong className="text-paper">{doc.jurisdiction}</strong>
            </span>
          </div>
        </div>
      </section>

      {/* Main Editorial Two-Column Layout with Sticky Policy Switcher */}
      <div className="mx-auto max-w-7xl px-5 pt-10 lg:px-8 lg:pt-12">
        <div className="grid gap-8 lg:grid-cols-[270px_1fr] lg:items-start">
          {/* Sticky Sidebar Switcher */}
          <aside className="lg:sticky lg:top-24">
            <div className="rounded-xl border border-ink/12 bg-white p-4 shadow-xs">
              <p className="mb-3 px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone">
                Legal &amp; Governance Policies
              </p>
              <nav className="space-y-1" aria-label="Legal policies">
                {LEGAL_DOCUMENTS.map((item) => {
                  const isActive = item.slug === activeSlug
                  return (
                    <Link
                      key={item.slug}
                      to="/legal/$slug"
                      params={{ slug: item.slug }}
                      className={`flex min-h-[42px] items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-medium transition duration-150 ${
                        isActive
                          ? 'bg-ink font-semibold text-gold shadow-xs'
                          : 'text-ink-3 hover:bg-paper-2 hover:text-ink'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <FileText size={13} className="shrink-0 opacity-80" />
                        <span>{item.shortTitle}</span>
                      </span>
                    </Link>
                  )
                })}
              </nav>

              <div className="mt-4 border-t border-ink/10 pt-3 px-2 text-[11px] leading-relaxed text-stone">
                Need to report an unverified licence or dispute? Use the{' '}
                <Link
                  to="/legal/$slug"
                  params={{ slug: 'complaints-procedure' }}
                  className="font-semibold text-ochre hover:underline"
                >
                  Complaints Procedure
                </Link>{' '}
                portal.
              </div>
            </div>
          </aside>

          {/* Main Document Body */}
          <article className="space-y-8">
            <div className="rounded-xl border border-ink/12 bg-white p-6 shadow-xs sm:p-8 lg:p-10">
              <div className="space-y-8">
                {doc.sections.map((section) => (
                  <section
                    key={section.heading}
                    className="border-b border-ink/8 pb-7 last:border-b-0 last:pb-0"
                  >
                    <h2 className="font-display text-2xl font-medium text-ink">
                      {section.heading}
                    </h2>
                    <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-3 sm:text-[15px]">
                      {section.paragraphs.map((p, idx) => (
                        <p key={idx}>{p}</p>
                      ))}
                    </div>
                    {section.bullets && section.bullets.length > 0 && (
                      <ul className="mt-4 space-y-2.5 pl-1 text-sm leading-relaxed text-ink-3">
                        {section.bullets.map((bullet, bIdx) => (
                          <li key={bIdx} className="flex items-start gap-2.5">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ochre" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </div>

            {/* Embedded 4-Step Timeline & Functional Complaint Form on Complaints Procedure */}
            {activeSlug === 'complaints-procedure' && (
              <ComplianceComplaintSection />
            )}
          </article>
        </div>
      </div>
    </div>
  )
}

function ComplianceComplaintSection() {
  const session = useAuthSession()

  const [reporterEmail, setReporterEmail] = useState(session?.user.email ?? '')
  const [category, setCategory] =
    useState<ComplianceComplaintCategory>('Unverified License')
  const [referenceCode, setReferenceCode] = useState('')
  const [description, setDescription] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trackingId, setTrackingId] = useState<string | null>(null)

  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null)
  const turnstileEnabled = isTurnstileEnabled()

  useEffect(() => {
    if (session?.user.email && !reporterEmail) {
      setReporterEmail(session.user.email)
    }
  }, [session?.user.email, reporterEmail])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (turnstileEnabled && !captchaToken) {
      setError('Please complete the security verification check before submitting.')
      return
    }

    setSubmitting(true)
    try {
      const verification = await verifyTurnstileForForm(
        captchaToken,
        'compliance-complaint'
      )
      if (!verification.ok) {
        setError(
          verification.error ||
            'Security verification failed or expired. Please complete the challenge again.'
        )
        return
      }

      const res = await submitComplianceComplaint({
        reporterEmail,
        category,
        referenceCode,
        description,
      })
      if (!res.ok) {
        setError(res.error || 'Unable to submit complaint. Please try again.')
        return
      }
      setTrackingId(res.trackingId || 'CMP-LOGGED')
      setReferenceCode('')
      setDescription('')
    } finally {
      setSubmitting(false)
      setCaptchaToken('')
      turnstileRef.current?.reset()
    }
  }

  return (
    <div className="space-y-6">
      {/* 4-Step Visual Escalation Timeline */}
      <div className="rounded-xl border border-ink/12 bg-paper-2/70 p-6">
        <p className="eyebrow text-ochre">Escalation SLA</p>
        <h2 className="mt-1 font-display text-2xl font-medium text-ink">
          4-Step Compliance &amp; Dispute Timeline
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['01', 'Intake Logged', 'Immediate reference assigned in compliance desk.'],
            ['02', 'Acknowledgment', 'Formal written acknowledgment within 48 hours.'],
            ['03', 'Investigation', 'Licence & claim audit completed within 7 business days.'],
            ['04', 'Remediation', 'Listing removal, badge action, or dispute closure notice.'],
          ].map(([num, title, desc]) => (
            <div
              key={num}
              className="rounded-lg border border-ink/10 bg-white p-4 shadow-xs"
            >
              <span className="font-mono text-xs font-semibold text-ochre">
                STEP {num}
              </span>
              <h3 className="mt-1 font-display text-lg font-medium text-ink">
                {title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-stone">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Functional Submit a Compliance or Listing Complaint Form */}
      <section className="rounded-xl border border-ink/12 bg-white p-6 shadow-xs sm:p-8">
        <p className="eyebrow text-ochre">Direct Compliance Intake</p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-ink">
          Submit a Compliance or Listing Complaint
        </h2>
        <p className="mt-1.5 text-sm text-stone">
          Reports are routed directly to Mine Connect Compliance Administrators for formal review.
        </p>

        {trackingId ? (
          <div
            role="status"
            className="mt-6 rounded-xl border border-moss/35 bg-moss-light p-5 text-sm text-moss"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  Complaint Recorded — Reference {trackingId}
                </p>
                <p className="mt-1 text-xs leading-relaxed opacity-90">
                  Your complaint has been logged. Our compliance team will review your report and follow up at your submitted email address within 48 hours.
                </p>
                <button
                  type="button"
                  onClick={() => setTrackingId(null)}
                  className="mt-3 text-xs font-semibold underline"
                >
                  Submit another compliance report
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="complaint-email" className="label">
                  Reporter Email *
                </label>
                <input
                  id="complaint-email"
                  type="email"
                  required
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                  placeholder="you@organization.co.tz"
                  className="field"
                />
              </div>

              <div>
                <label htmlFor="complaint-category" className="label">
                  Complaint Category *
                </label>
                <select
                  id="complaint-category"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as ComplianceComplaintCategory)
                  }
                  className="field"
                >
                  {COMPLAINT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="complaint-ref" className="label">
                Listing ID, Licence Number, or Company Reference
              </label>
              <input
                id="complaint-ref"
                type="text"
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                placeholder="e.g., MC-TZ-001, PML 04821, or Company Name"
                className="field"
              />
            </div>

            <div>
              <label htmlFor="complaint-desc" className="label">
                Detailed Description &amp; Supporting Facts *
              </label>
              <textarea
                id="complaint-desc"
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the licence discrepancy, misleading claim, circumvention incident, or privacy concern in detail..."
                className="field resize-none"
              />
            </div>

            {turnstileEnabled && (
              <TurnstileWidget
                ref={turnstileRef}
                theme="light"
                action="compliance-complaint"
                onVerify={(token) => {
                  setCaptchaToken(token)
                  setError(null)
                }}
                onExpire={() => setCaptchaToken('')}
                onError={(msg) => {
                  setCaptchaToken('')
                  if (msg) setError(msg)
                }}
              />
            )}

            <button
              type="submit"
              disabled={
                submitting ||
                !reporterEmail.trim() ||
                !description.trim() ||
                (turnstileEnabled && !captchaToken)
              }
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Submitting Report...
                </>
              ) : (
                <>
                  <Send size={15} />
                  Submit Compliance Complaint
                </>
              )}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
