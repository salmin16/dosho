import { type NextRequest } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

/**
 * Edge-Level Next.js Middleware (`src/middleware.ts`)
 * Intercepts all incoming HTTP traffic at the edge to enforce:
 * 1. Enterprise HTTP Security Headers & Content-Security-Policy (CSP)
 * 2. Strict Route Guardrails on `/admin/*` and `/api/admin/*`
 * 3. Dual-Token & Database Role Verification (`role === 'admin'` in `public.user_profiles` / `public.users`)
 * 4. Fail-Safe 403 Forbidden termination or `/login` redirect on unauthorized attempts
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths including /admin/*, /api/admin/*, /dashboard/*, and /vault/* except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static image/geojson assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|geojson)$).*)',
  ],
};
