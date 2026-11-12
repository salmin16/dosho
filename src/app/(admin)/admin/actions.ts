'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { logActivity } from '@/utils/audit-logger';
import type { UserRole, UserStatus } from '@/types/database';

export interface AdminActionResult {
  success?: boolean;
  error?: string;
}

async function requireAdminSession() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error('Unauthorized: Authentication required.');
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin' || profile.status !== 'active') {
    logActivity({
      userId: user.id,
      action: 'UNAUTHORIZED_ADMIN_ATTEMPT',
      metadata: { source: 'AdminServerAction' },
    });
    throw new Error('Forbidden: Admin clearance required.');
  }

  return { supabase, adminUser: user };
}

export async function updateUserRoleAction(
  targetUserId: string,
  newRole: UserRole
): Promise<AdminActionResult> {
  try {
    const { supabase, adminUser } = await requireAdminSession();

    if (targetUserId === adminUser.id && newRole !== 'admin') {
      return { error: 'You cannot demote your own admin account.' };
    }

    const { data: updated, error } = await supabase
      .from('user_profiles')
      .update({ role: newRole })
      .eq('id', targetUserId)
      .select('email, role')
      .single();

    if (error) {
      return { error: error.message };
    }

    logActivity({
      userId: adminUser.id,
      action: 'ADMIN_UPDATE_ROLE',
      metadata: {
        targetUserId,
        targetEmail: updated?.email,
        newRole,
      },
    });

    revalidatePath('/admin');
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to update user role.',
    };
  }
}

export async function updateUserStatusAction(
  targetUserId: string,
  newStatus: UserStatus
): Promise<AdminActionResult> {
  try {
    const { supabase, adminUser } = await requireAdminSession();

    if (targetUserId === adminUser.id && newStatus === 'suspended') {
      return { error: 'You cannot suspend your own admin account.' };
    }

    const { data: updated, error } = await supabase
      .from('user_profiles')
      .update({ status: newStatus })
      .eq('id', targetUserId)
      .select('email, status')
      .single();

    if (error) {
      return { error: error.message };
    }

    logActivity({
      userId: adminUser.id,
      action:
        newStatus === 'suspended'
          ? 'ADMIN_SUSPEND_USER'
          : 'ADMIN_ACTIVATE_USER',
      metadata: {
        targetUserId,
        targetEmail: updated?.email,
        newStatus,
      },
    });

    revalidatePath('/admin');
    return { success: true };
  } catch (err) {
    return {
      error:
        err instanceof Error ? err.message : 'Failed to update user status.',
    };
  }
}

export async function deleteUserAccountAction(
  targetUserId: string
): Promise<AdminActionResult> {
  try {
    const { supabase, adminUser } = await requireAdminSession();

    if (targetUserId === adminUser.id) {
      return { error: 'You cannot delete your own admin account.' };
    }

    const { data: targetProfile } = await supabase
      .from('user_profiles')
      .select('email, role')
      .eq('id', targetUserId)
      .single();

    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', targetUserId);

    if (error) {
      return { error: error.message };
    }

    logActivity({
      userId: adminUser.id,
      action: 'ADMIN_DELETE_USER',
      metadata: {
        targetUserId,
        targetEmail: targetProfile?.email ?? 'unknown',
      },
    });

    revalidatePath('/admin');
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to delete user.',
    };
  }
}
