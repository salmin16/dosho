import React from 'react';
import { createClient } from '@/utils/supabase/server';
import UserDirectoryClient from './UserDirectoryClient';
import type { AuditLog, UserProfile } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function AdminUsersDirectoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: usersData }, { data: logsData }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, email, full_name, role, status, preferred_currency, created_at, updated_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  return (
    <UserDirectoryClient
      currentAdminId={user?.id ?? ''}
      initialUsers={(usersData as UserProfile[] | null) ?? []}
      auditLogs={(logsData as AuditLog[] | null) ?? []}
    />
  );
}
