'use client'

import { GuidedOpportunityWizard } from '@/components/GuidedSubmissionWizards'

export default function NextDashboardOpportunitiesPage() {
  return (
    <div className="min-h-screen bg-paper px-5 pb-24 pt-28 text-ink lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-2xl border border-ink/15 bg-ink p-6 text-paper shadow-xl contours lg:p-8">
          <span className="eyebrow text-gold">
            Authenticated Publishing Studio · public.opportunities
          </span>
          <h1 className="mt-2 font-display text-3xl font-semibold text-paper">
            Guided Opportunity Publishing Module
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-paper/75">
            Step-by-step guided workflow for publishing mining tenders, consultancies,
            exploration grants, JVs, and internships with instant admin moderation queue
            integration.
          </p>
        </div>

        <GuidedOpportunityWizard />
      </div>
    </div>
  )
}
