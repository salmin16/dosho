import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logActivity } from '@/utils/audit-logger';
import type { ContentStatus, UnifiedContentType } from '@/types/database';

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

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, email, role, status')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin' || profile.status !== 'active') {
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
  };
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAdminClearance();
  if (!auth.authorized) {
    logActivity({
      userId: auth.user?.id ?? null,
      action: 'UNAUTHORIZED_ADMIN_ATTEMPT',
      req: request,
      metadata: { endpoint: 'PATCH /api/admin/content' },
    });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      type?: UnifiedContentType;
      title?: string;
      details?: string;
      status?: ContentStatus;
      moderationNotes?: string;
    };

    const { id, type, title, details, status, moderationNotes } = body;
    if (!id || !type || !title || !details || !status) {
      return NextResponse.json(
        { error: 'id, type, title, details, and status are required.' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const isApproved = status === 'active';

    if (type === 'DOCUMENT') {
      const { error } = await auth.supabase
        .from('user_documents')
        .update({
          title: title.trim(),
          content: details.trim(),
          status,
          approved: isApproved,
          moderation_notes: moderationNotes ?? null,
          reviewed_by: auth.user.id,
          reviewed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else if (type === 'PROJECT') {
      const mappedStatus =
        status === 'active'
          ? 'VERIFIED'
          : status === 'archived'
            ? 'ARCHIVED'
            : status === 'flagged'
              ? 'FLAGGED'
              : status === 'rejected'
                ? 'REJECTED'
                : 'PENDING_VERIFICATION';

      const { error } = await auth.supabase
        .from('user_projects')
        .update({
          title: title.trim(),
          summary: details.trim(),
          status: mappedStatus,
          approved: isApproved,
          moderation_notes: moderationNotes ?? null,
          reviewed_by: auth.user.id,
          reviewed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else if (type === 'QUOTE') {
      const mappedStatus =
        status === 'active'
          ? 'QUOTED'
          : status === 'archived'
            ? 'CLOSED'
            : status === 'flagged'
              ? 'FLAGGED'
              : status === 'rejected'
                ? 'REJECTED'
                : 'SUBMITTED';

      const { error } = await auth.supabase
        .from('quote_requests')
        .update({
          service_requested: title.trim(),
          scope_notes: details.trim(),
          status: mappedStatus,
          approved: isApproved,
          moderation_notes: moderationNotes ?? null,
          reviewed_by: auth.user.id,
          reviewed_at: nowIso,
        })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    logActivity({
      userId: auth.user.id,
      action: 'ADMIN_EDIT_CONTENT',
      req: request,
      metadata: { recordId: id, contentType: type, title, newStatus: status },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminClearance();
  if (!auth.authorized) {
    logActivity({
      userId: auth.user?.id ?? null,
      action: 'UNAUTHORIZED_ADMIN_ATTEMPT',
      req: request,
      metadata: { endpoint: 'DELETE /api/admin/content' },
    });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type') as UnifiedContentType | null;

  if (!id || !type) {
    return NextResponse.json(
      { error: 'id and type query parameters are required.' },
      { status: 400 }
    );
  }

  const table =
    type === 'DOCUMENT'
      ? 'user_documents'
      : type === 'PROJECT'
        ? 'user_projects'
        : 'quote_requests';

  const { error } = await auth.supabase.from(table).delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logActivity({
    userId: auth.user.id,
    action: 'ADMIN_PURGE_CONTENT',
    req: request,
    metadata: { recordId: id, contentType: type, table },
  });

  return NextResponse.json({ success: true, purgedId: id });
}
