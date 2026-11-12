import React from 'react';
import { createClient } from '@/utils/supabase/server';
import ApprovalQueueClient from './ApprovalQueueClient';
import type {
  QuoteRequestRecord,
  UnifiedContentRecord,
  UserDocument,
  UserListedProject,
  UserProfile,
} from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function AdminApprovalsPage() {
  const supabase = await createClient();

  const [
    { data: profilesData },
    { data: docsData },
    { data: projectsData },
    { data: quotesData },
  ] = await Promise.all([
    supabase.from('user_profiles').select('*'),
    supabase
      .from('user_documents')
      .select('*')
      .or('status.eq.pending,status.eq.flagged,approved.eq.false')
      .order('created_at', { ascending: false }),
    supabase
      .from('user_projects')
      .select('*')
      .or('status.eq.PENDING_VERIFICATION,status.eq.FLAGGED,approved.eq.false')
      .order('created_at', { ascending: false }),
    supabase
      .from('quote_requests')
      .select('*')
      .or('status.eq.SUBMITTED,status.eq.FLAGGED,approved.eq.false')
      .order('created_at', { ascending: false }),
  ]);

  const profiles = (profilesData as UserProfile[] | null) ?? [];
  const profileMap = new Map<string, UserProfile>();
  profiles.forEach((p) => profileMap.set(p.id, p));

  const docs = (docsData as UserDocument[] | null) ?? [];
  const projects = (projectsData as UserListedProject[] | null) ?? [];
  const quotes = (quotesData as QuoteRequestRecord[] | null) ?? [];

  const pendingItems: UnifiedContentRecord[] = [
    ...projects.map((p): UnifiedContentRecord => {
      const owner = profileMap.get(p.user_id);
      return {
        id: p.id,
        type: 'PROJECT',
        user_id: p.user_id,
        owner_email: owner?.email ?? 'member@mineconnect.co.tz',
        owner_name: owner?.full_name ?? 'Licence Holder',
        title: p.title,
        details: p.summary,
        category_badge: `${p.mineral} · ${p.region}`,
        reference_code: `${p.licence_type} (${p.licence_reference})`,
        value_usd: p.investment_usd,
        status: p.status === 'FLAGGED' ? 'flagged' : 'pending',
        raw_status: p.status,
        approved: false,
        moderation_notes: p.moderation_notes ?? null,
        created_at: p.created_at,
        updated_at: p.updated_at,
      };
    }),
    ...docs.map((d): UnifiedContentRecord => {
      const owner = profileMap.get(d.user_id);
      return {
        id: d.id,
        type: 'DOCUMENT',
        user_id: d.user_id,
        owner_email: owner?.email ?? 'member@mineconnect.co.tz',
        owner_name: owner?.full_name ?? 'Vault Member',
        title: d.title,
        details: d.content,
        category_badge: `CLASSIFICATION: ${d.classification}`,
        reference_code: `DOC-${d.id.slice(0, 8).toUpperCase()}`,
        value_usd: null,
        status: d.status === 'flagged' ? 'flagged' : 'pending',
        raw_status: d.status ?? 'PENDING',
        approved: false,
        moderation_notes: d.moderation_notes ?? null,
        created_at: d.created_at,
        updated_at: d.updated_at,
      };
    }),
    ...quotes.map((q): UnifiedContentRecord => {
      const owner = profileMap.get(q.user_id);
      return {
        id: q.id,
        type: 'QUOTE',
        user_id: q.user_id,
        owner_email: owner?.email ?? 'member@mineconnect.co.tz',
        owner_name: owner?.full_name ?? 'Project Operator',
        title: q.service_requested,
        details: q.scope_notes,
        category_badge: `PROVIDER: ${q.provider_name}`,
        reference_code: `RFQ-${q.id.slice(0, 8).toUpperCase()}`,
        value_usd: q.estimated_budget_usd,
        status: q.status === 'FLAGGED' ? 'flagged' : 'pending',
        raw_status: q.status,
        approved: false,
        moderation_notes: q.moderation_notes ?? null,
        created_at: q.created_at,
        updated_at: q.created_at,
      };
    }),
  ];

  return <ApprovalQueueClient initialQueue={pendingItems} />;
}
