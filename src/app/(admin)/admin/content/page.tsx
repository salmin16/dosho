import React from 'react';
import { createClient } from '@/utils/supabase/server';
import ContentExplorerClient from './ContentExplorerClient';
import type {
  ContentStatus,
  QuoteRequestRecord,
  UnifiedContentRecord,
  UserDocument,
  UserListedProject,
  UserProfile,
} from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function AdminContentExplorerPage() {
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
      .order('created_at', { ascending: false }),
    supabase
      .from('user_projects')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('quote_requests')
      .select('*')
      .order('created_at', { ascending: false }),
  ]);

  const profiles = (profilesData as UserProfile[] | null) ?? [];
  const profileMap = new Map<string, UserProfile>();
  profiles.forEach((p) => profileMap.set(p.id, p));

  const docs = (docsData as UserDocument[] | null) ?? [];
  const projects = (projectsData as UserListedProject[] | null) ?? [];
  const quotes = (quotesData as QuoteRequestRecord[] | null) ?? [];

  const unifiedContent: UnifiedContentRecord[] = [
    ...projects.map((p): UnifiedContentRecord => {
      const owner = profileMap.get(p.user_id);
      const status: ContentStatus =
        p.status === 'REJECTED'
          ? 'rejected'
          : p.status === 'FLAGGED'
            ? 'flagged'
            : p.status === 'ARCHIVED'
              ? 'archived'
              : p.status === 'VERIFIED' || p.approved
                ? 'active'
                : 'pending';
      return {
        id: p.id,
        type: 'PROJECT',
        user_id: p.user_id,
        owner_email: owner?.email ?? 'unknown@mineconnect.co.tz',
        owner_name: owner?.full_name ?? 'Licence Holder',
        title: p.title,
        details: p.summary,
        category_badge: `${p.mineral} · ${p.region}`,
        reference_code: `${p.licence_type} (${p.licence_reference})`,
        value_usd: p.investment_usd,
        status,
        raw_status: p.status,
        approved: Boolean(p.approved || p.status === 'VERIFIED'),
        moderation_notes: p.moderation_notes ?? null,
        created_at: p.created_at,
        updated_at: p.updated_at,
      };
    }),
    ...docs.map((d): UnifiedContentRecord => {
      const owner = profileMap.get(d.user_id);
      const status: ContentStatus =
        d.status ?? (d.approved === false ? 'pending' : 'active');
      return {
        id: d.id,
        type: 'DOCUMENT',
        user_id: d.user_id,
        owner_email: owner?.email ?? 'unknown@mineconnect.co.tz',
        owner_name: owner?.full_name ?? 'Vault Member',
        title: d.title,
        details: d.content,
        category_badge: `CLASSIFICATION: ${d.classification}`,
        reference_code: `DOC-${d.id.slice(0, 8).toUpperCase()}`,
        value_usd: null,
        status,
        raw_status: status.toUpperCase(),
        approved: d.approved ?? status === 'active',
        moderation_notes: d.moderation_notes ?? null,
        created_at: d.created_at,
        updated_at: d.updated_at,
      };
    }),
    ...quotes.map((q): UnifiedContentRecord => {
      const owner = profileMap.get(q.user_id);
      const status: ContentStatus =
        q.status === 'REJECTED'
          ? 'rejected'
          : q.status === 'FLAGGED'
            ? 'flagged'
            : q.status === 'CLOSED'
              ? 'archived'
              : q.status === 'QUOTED' || q.approved
                ? 'active'
                : 'pending';
      return {
        id: q.id,
        type: 'QUOTE',
        user_id: q.user_id,
        owner_email: owner?.email ?? 'unknown@mineconnect.co.tz',
        owner_name: owner?.full_name ?? 'Operator',
        title: q.service_requested,
        details: q.scope_notes,
        category_badge: `PROVIDER: ${q.provider_name}`,
        reference_code: `RFQ-${q.id.slice(0, 8).toUpperCase()}`,
        value_usd: q.estimated_budget_usd,
        status,
        raw_status: q.status,
        approved: Boolean(q.approved || q.status === 'QUOTED'),
        moderation_notes: q.moderation_notes ?? null,
        created_at: q.created_at,
        updated_at: q.created_at,
      };
    }),
  ].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return <ContentExplorerClient initialRecords={unifiedContent} />;
}
