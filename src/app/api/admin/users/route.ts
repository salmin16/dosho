import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logActivity } from '@/utils/audit-logger';
import type { UserRole, UserStatus } from '@/types/database';

/**
 * Verifies that the caller has an authenticated session and holds `role === 'admin'`.
 * Defense-in-depth: Validates both at the route handler level and via PostgreSQL RLS.
 */
async function verifyAdminClearance() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      authorized: false as const,
      status: 401,
      error: 'Unauthorized: Valid session required.',
      supabase,
      user: null,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, email, role, status')
    .eq('id', user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.role !== 'admin' ||
    profile.status !== 'active'
  ) {
    return {
      authorized: false as const,
      status: 403,
      error: 'Forbidden: Administrative clearance required.',
      supabase,
      user,
    };
  }

  return {
    authorized: true as const,
    status: 200,
    error: null,
    supabase,
    user,
    profile,
  };
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAdminClearance();

  if (!auth.authorized) {
    logActivity({
      userId: auth.user?.id ?? null,
      action: 'UNAUTHORIZED_ADMIN_ATTEMPT',
      req: request,
      metadata: { endpoint: 'PATCH /api/admin/users' },
    });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as {
      targetUserId?: string;
      role?: UserRole;
      status?: UserStatus;
    };

    const { targetUserId, role, status } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'targetUserId is required.' },
        { status: 400 }
      );
    }

    // Prevent admins from accidentally demoting or suspending their own active account
    if (targetUserId === auth.user.id && (role === 'user' || status === 'suspended')) {
      return NextResponse.json(
        { error: 'Cannot demote or suspend your own active admin account.' },
        { status: 400 }
      );
    }

    const updates: { role?: UserRole; status?: UserStatus } = {};
    if (role && (role === 'user' || role === 'admin')) {
      updates.role = role;
    }
    if (status && (status === 'active' || status === 'suspended')) {
      updates.status = status;
    }

    const { data: updatedUser, error: updateError } = await auth.supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', targetUserId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const actionType =
      status === 'suspended'
        ? 'ADMIN_SUSPEND_USER'
        : status === 'active'
        ? 'ADMIN_ACTIVATE_USER'
        : 'ADMIN_UPDATE_ROLE';

    logActivity({
      userId: auth.user.id,
      action: actionType,
      req: request,
      metadata: {
        targetUserId,
        targetEmail: updatedUser.email,
        updates,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request payload.' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminClearance();

  if (!auth.authorized) {
    logActivity({
      userId: auth.user?.id ?? null,
      action: 'UNAUTHORIZED_ADMIN_ATTEMPT',
      req: request,
      metadata: { endpoint: 'DELETE /api/admin/users' },
    });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get('userId');

  if (!targetUserId) {
    return NextResponse.json(
      { error: 'userId query parameter is required.' },
      { status: 400 }
    );
  }

  if (targetUserId === auth.user.id) {
    return NextResponse.json(
      { error: 'Cannot delete your own active admin account.' },
      { status: 400 }
    );
  }

  const { data: targetProfile } = await auth.supabase
    .from('user_profiles')
    .select('email, role')
    .eq('id', targetUserId)
    .single();

  const { error: deleteError } = await auth.supabase
    .from('user_profiles')
    .delete()
    .eq('id', targetUserId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  logActivity({
    userId: auth.user.id,
    action: 'ADMIN_DELETE_USER',
    req: request,
    metadata: {
      targetUserId,
      targetEmail: targetProfile?.email ?? 'unknown',
      previousRole: targetProfile?.role ?? 'unknown',
    },
  });

  return NextResponse.json({ success: true, deletedUserId: targetUserId });
}
