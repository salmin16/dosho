'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/utils/supabase/server';
import { logActivity } from '@/utils/audit-logger';
import type {
  OpportunitySubmissionCategory,
  ServiceExpertiseArea,
  UserOpportunityRecord,
  UserServiceRecord,
} from '@/types/database';

export interface SubmitOpportunityPayload {
  title: string;
  organization: string;
  category: OpportunitySubmissionCategory;
  location: string;
  deadline: string;
  compensationUsd: number;
  description: string;
  requirements: string[];
  verifiedComplianceChecklist: boolean;
}

export interface SubmitServicePayload {
  serviceName: string;
  providerOrganization: string;
  expertiseArea: ServiceExpertiseArea;
  regionalCoverage: string;
  rateOrPricingModel: string;
  estimatedRateUsd: number;
  scopeDescription: string;
  portfolioLinks: string;
  certifications: string;
  verifiedComplianceChecklist: boolean;
}

/**
 * Server Action: Validate and insert a new Opportunity submission (`public.opportunities`)
 * with `status = 'pending'`, bound to `auth.uid()`, and register an immutable audit log entry.
 */
export async function submitOpportunityAction(
  payload: SubmitOpportunityPayload
): Promise<{
  success: boolean;
  opportunity?: UserOpportunityRecord;
  error?: string;
}> {
  if (!payload.verifiedComplianceChecklist) {
    return {
      success: false,
      error:
        'All statutory & anti-fraud verification checklist items must be confirmed before publishing.',
    };
  }

  const title = payload.title?.trim() ?? '';
  const organization = payload.organization?.trim() ?? '';
  const location = payload.location?.trim() ?? '';
  const deadline = payload.deadline?.trim() ?? '';
  const description = payload.description?.trim() ?? '';
  const requirements = (payload.requirements || [])
    .map((r) => r.trim())
    .filter(Boolean);

  if (title.length < 5 || title.length > 200) {
    return {
      success: false,
      error: 'Opportunity title must be between 5 and 200 characters.',
    };
  }
  if (organization.length < 2 || organization.length > 160) {
    return {
      success: false,
      error: 'Organization name must be between 2 and 160 characters.',
    };
  }
  if (!location || !deadline) {
    return {
      success: false,
      error: 'Location (Mkoa) and deadline date are required.',
    };
  }
  if (description.length < 20) {
    return {
      success: false,
      error: 'Detailed scope description must be at least 20 characters.',
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return {
      success: false,
      error: '401 Unauthorized: Active authenticated session required.',
    };
  }

  const prefix = payload.category.slice(0, 3).toUpperCase();
  const referenceCode = `OPP-${prefix}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  const { data, error } = await supabase
    .from('opportunities')
    .insert({
      user_id: user.id,
      title,
      organization,
      category: payload.category,
      location,
      deadline,
      compensation_usd: Math.max(0, Number(payload.compensationUsd) || 0),
      description,
      requirements,
      reference_code: referenceCode,
      status: 'pending',
      approved: false,
    })
    .select('*')
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? 'Failed to insert opportunity into PostgreSQL.',
    };
  }

  await logActivity({
    userId: user.id,
    action: 'CREATE_OPPORTUNITY',
    metadata: {
      opportunityId: data.id,
      referenceCode: data.reference_code,
      title: data.title,
      category: data.category,
      location: data.location,
      status: 'pending',
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/opportunities');
  revalidatePath('/admin/approvals');
  revalidatePath('/admin/content');

  return {
    success: true,
    opportunity: data as UserOpportunityRecord,
  };
}

/**
 * Server Action: Validate and insert a new Professional Service submission (`public.services`)
 * with `status = 'pending'`, bound to `auth.uid()`, and register an immutable audit log entry.
 */
export async function submitServiceAction(
  payload: SubmitServicePayload
): Promise<{
  success: boolean;
  service?: UserServiceRecord;
  error?: string;
}> {
  if (!payload.verifiedComplianceChecklist) {
    return {
      success: false,
      error:
        'All service verification and fee-disclosure checklist items must be confirmed before publishing.',
    };
  }

  const serviceName = payload.serviceName?.trim() ?? '';
  const providerOrganization = payload.providerOrganization?.trim() ?? '';
  const regionalCoverage =
    payload.regionalCoverage?.trim() || 'All Tanzania (31 Mikoa)';
  const rateOrPricingModel = payload.rateOrPricingModel?.trim() ?? '';
  const scopeDescription = payload.scopeDescription?.trim() ?? '';

  if (serviceName.length < 5 || serviceName.length > 200) {
    return {
      success: false,
      error: 'Service name must be between 5 and 200 characters.',
    };
  }
  if (providerOrganization.length < 2 || providerOrganization.length > 160) {
    return {
      success: false,
      error: 'Provider organization must be between 2 and 160 characters.',
    };
  }
  if (!rateOrPricingModel) {
    return {
      success: false,
      error: 'Rate or pricing model is required.',
    };
  }
  if (scopeDescription.length < 20) {
    return {
      success: false,
      error: 'Scope description must be at least 20 characters.',
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return {
      success: false,
      error: '401 Unauthorized: Active authenticated session required.',
    };
  }

  const prefix = payload.expertiseArea.slice(0, 3).toUpperCase();
  const referenceCode = `SRV-${prefix}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  const { data, error } = await supabase
    .from('services')
    .insert({
      user_id: user.id,
      service_name: serviceName,
      provider_organization: providerOrganization,
      expertise_area: payload.expertiseArea,
      regional_coverage: regionalCoverage,
      rate_or_pricing_model: rateOrPricingModel,
      estimated_rate_usd: Math.max(0, Number(payload.estimatedRateUsd) || 0),
      scope_description: scopeDescription,
      portfolio_links: payload.portfolioLinks?.trim() ?? '',
      certifications: payload.certifications?.trim() ?? '',
      reference_code: referenceCode,
      status: 'pending',
      approved: false,
    })
    .select('*')
    .single();

  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? 'Failed to insert service into PostgreSQL.',
    };
  }

  await logActivity({
    userId: user.id,
    action: 'CREATE_SERVICE',
    metadata: {
      serviceId: data.id,
      referenceCode: data.reference_code,
      serviceName: data.service_name,
      expertiseArea: data.expertise_area,
      status: 'pending',
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/services');
  revalidatePath('/admin/approvals');
  revalidatePath('/admin/content');

  return {
    success: true,
    service: data as UserServiceRecord,
  };
}
