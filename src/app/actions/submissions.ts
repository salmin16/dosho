'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/utils/supabase/server';
import { logActivity } from '@/utils/audit-logger';
import {
  OpportunitySubmissionSchema,
  ServiceSubmissionSchema,
} from '../../lib/securityValidators';
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
 * Server Action: Zero-Trust Zod-validated Opportunity submission (`public.opportunities`)
 * with `status = 'pending'`, bound to `auth.uid()`, and immutable audit log entry.
 */
export async function submitOpportunityAction(
  payload: SubmitOpportunityPayload
): Promise<{
  success: boolean;
  opportunity?: UserOpportunityRecord;
  error?: string;
}> {
  const parsed = OpportunitySubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.message,
    };
  }

  const valid = parsed.data;

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

  const prefix = valid.category.slice(0, 3).toUpperCase();
  const referenceCode = `OPP-${prefix}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  const { data, error } = await supabase
    .from('opportunities')
    .insert({
      user_id: user.id,
      title: valid.title,
      organization: valid.organization,
      category: valid.category,
      location: valid.location,
      deadline: valid.deadline,
      compensation_usd: valid.compensationUsd,
      description: valid.description,
      requirements: valid.requirements,
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
 * Server Action: Zero-Trust Zod-validated Professional Service submission (`public.services`)
 * with `status = 'pending'`, bound to `auth.uid()`, and immutable audit log entry.
 */
export async function submitServiceAction(
  payload: SubmitServicePayload
): Promise<{
  success: boolean;
  service?: UserServiceRecord;
  error?: string;
}> {
  const parsed = ServiceSubmissionSchema.safeParse({
    ...payload,
    regionalCoverage:
      payload.regionalCoverage?.trim() || 'All Tanzania (31 Mikoa)',
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.message,
    };
  }

  const valid = parsed.data;

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

  const prefix = valid.expertiseArea.slice(0, 3).toUpperCase();
  const referenceCode = `SRV-${prefix}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  const { data, error } = await supabase
    .from('services')
    .insert({
      user_id: user.id,
      service_name: valid.serviceName,
      provider_organization: valid.providerOrganization,
      expertise_area: valid.expertiseArea,
      regional_coverage: valid.regionalCoverage,
      rate_or_pricing_model: valid.rateOrPricingModel,
      estimated_rate_usd: valid.estimatedRateUsd,
      scope_description: valid.scopeDescription,
      portfolio_links: valid.portfolioLinks,
      certifications: valid.certifications,
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
