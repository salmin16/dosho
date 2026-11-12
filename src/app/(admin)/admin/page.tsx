import React from 'react';
import { createClient } from '@/utils/supabase/server';
import AdminDashboardClient from './AdminDashboardClient';
import type { AuditLog, UserProfile } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const startTime = Date.now();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Execute parallel queries protected by `public.is_admin()` PostgreSQL RLS policies
  const [{ data: usersData, error: usersError }, { data: logsData, error: logsError }, { count: docCount }] =
    await Promise.all([
      supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('user_documents')
        .select('*', { count: 'exact', head: true }),
    ]);

  const dbLatencyMs = Math.max(1, Date.now() - startTime);

  const users: UserProfile[] = (usersData as UserProfile[] | null) ?? [];
  const auditLogs: AuditLog[] = (logsData as AuditLog[] | null) ?? [];

  // Compute real-time analytics metrics
  const now = Date.now();
  const last24hCutoff = now - 24 * 60 * 60 * 1000;

  const recentLogs24h = auditLogs.filter(
    (log) => new Date(log.created_at).getTime() >= last24hCutoff
  );

  // Active sessions approximated by distinct users with activity in the last 24h (minimum 1 for current admin)
  const activeUserIds24h = new Set(
    recentLogs24h.map((l) => l.user_id).filter(Boolean)
  );
  if (user?.id) {
    activeUserIds24h.add(user.id);
  }

  const errorEvents24h = recentLogs24h.filter(
    (log) =>
      log.action.includes('FAILED') ||
      log.action.includes('ERROR') ||
      log.action.includes('UNAUTHORIZED')
  );

  const errorRatePercent =
    recentLogs24h.length > 0
      ? Number(((errorEvents24h.length / recentLogs24h.length) * 100).toFixed(2))
      : 0;

  const healthMetrics = {
    dbLatencyMs,
    rlsEnforced: !usersError && !logsError,
    apiStatus: usersError || logsError ? ('degraded' as const) : ('healthy' as const),
    totalDocumentsCount: docCount ?? 0,
    lastCheckedIso: new Date().toISOString(),
  };

  return (
    <AdminDashboardClient
      currentAdminId={user?.id ?? ''}
      initialUsers={users}
      initialAuditLogs={auditLogs}
      activeSessionsCount={activeUserIds24h.size}
      errorRatePercent={errorRatePercent}
      errorEventsCount24h={errorEvents24h.length}
      healthMetrics={healthMetrics}
    />
  );
}
