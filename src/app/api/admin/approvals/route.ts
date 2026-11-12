import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logActivity } from '@/utils/audit-logger';
import type { UnifiedContentType } from '@/types/database';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized: Valid session required.' },
      { status: 401 }
    );
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, email, role, status')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin' || profile.status !== 'active') {
    logActivity({
      userId: user.id,
      action: 'UNAUTHORIZED_ADMIN_ATTEMPT',
      req: request,
      metadata: { endpoint: 'POST /api/admin/approvals' },
    });
    return NextResponse.json(
      { error: 'Forbidden: Administrative clearance required.' },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as {
      id?: string;
      type?: UnifiedContentType;
      decision?: 'APPROVE' | 'REJECT';
      notes?: string;
    };

    const { id, type, decision, notes } = body;
    if (!id || !type || !decision) {
      return NextResponse.json(
        { error: 'id, type, and decision (APPROVE | REJECT) are required.' },
        { status: 400 }
      );
    }

    const isApproved = decision === 'APPROVE';
    const nowIso = new Date().toISOString();
    const moderationNotes =
      notes?.trim() ||
      (isApproved
        ? 'Approved and verified by Admin Governance Console.'
        : 'Rejected during administrative compliance review.');

    if (type === 'PROJECT') {
      const { error } = await supabase
        .from('user_projects')
        .update({
          status: isApproved ? 'VERIFIED' : 'REJECTED',
          approved: isApproved,
          moderation_notes: moderationNotes,
          reviewed_by: user.id,
          reviewed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else if (type === 'DOCUMENT') {
      const { error } = await supabase
        .from('user_documents')
        .update({
          status: isApproved ? 'active' : 'rejected',
          approved: isApproved,
          moderation_notes: moderationNotes,
          reviewed_by: user.id,
          reviewed_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else if (type === 'QUOTE') {
      const { error } = await supabase
        .from('quote_requests')
        .update({
          status: isApproved ? 'QUOTED' : 'REJECTED',
          approved: isApproved,
          moderation_notes: moderationNotes,
          reviewed_by: user.id,
          reviewed_at: nowIso,
        })
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    logActivity({
      userId: user.id,
      action: isApproved
        ? 'ADMIN_APPROVE_SUBMISSION'
        : 'ADMIN_REJECT_SUBMISSION',
      req: request,
      metadata: {
        recordId: id,
        contentType: type,
        decision,
        notes: moderationNotes,
      },
    });

    return NextResponse.json({
      success: true,
      id,
      type,
      decision,
      reviewedAt: nowIso,
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid moderation payload.' },
      { status: 400 }
    );
  }
}
