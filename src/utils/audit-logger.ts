import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { AuditAction, Json } from '@/types/database';

export interface LogActivityParams {
  userId?: string | null;
  action: AuditAction;
  req?: NextRequest | Request;
  metadata?: Record<string, unknown>;
}

/**
 * Extracts client IP address and User-Agent from either an explicit Request object
 * or Next.js Server Component / Server Action request headers.
 */
async function extractClientContext(req?: NextRequest | Request): Promise<{
  ipAddress: string;
  userAgent: string;
}> {
  try {
    if (req) {
      const forwardedFor = req.headers.get('x-forwarded-for');
      const realIp = req.headers.get('x-real-ip');
      const ipAddress = forwardedFor
        ? forwardedFor.split(',')[0].trim()
        : realIp || '0.0.0.0';
      const userAgent = req.headers.get('user-agent') || 'Unknown';
      return { ipAddress, userAgent };
    }

    const headerStore = await headers();
    const forwardedFor = headerStore.get('x-forwarded-for');
    const realIp = headerStore.get('x-real-ip');
    const ipAddress = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : realIp || '0.0.0.0';
    const userAgent = headerStore.get('user-agent') || 'Unknown';

    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: '0.0.0.0', userAgent: 'Server-Internal' };
  }
}

/**
 * Non-blocking asynchronous audit logger.
 * Records critical user and administrative actions to `public.audit_logs`
 * without blocking or crashing the primary request lifecycle.
 */
export function logActivity({
  userId = null,
  action,
  req,
  metadata = {},
}: LogActivityParams): void {
  void (async () => {
    try {
      const [{ ipAddress, userAgent }, supabase] = await Promise.all([
        extractClientContext(req),
        createClient(),
      ]);

      let resolvedUserId = userId;
      if (!resolvedUserId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        resolvedUserId = user?.id ?? null;
      }

      const { error } = await supabase.from('audit_logs').insert({
        user_id: resolvedUserId,
        action,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: metadata as Json,
      });

      if (error) {
        console.error('[AuditLogger] Failed to write audit log:', error.message);
      }
    } catch (err) {
      console.error('[AuditLogger] Unexpected audit logging failure:', err);
    }
  })();
}
