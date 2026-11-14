import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Enterprise Content-Security-Policy (CSP) & HTTP Hardening Headers
 * Restricts script, connect, style, and frame sources strictly to trusted origins.
 */
export const ENTERPRISE_SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-XSS-Protection': '1; mode=block',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(self), payment=(), usb=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.basemaps.cartocdn.com https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.frankfurter.app https://open.er-api.com https://api.gold-api.com https://tile.openstreetmap.org",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [header, value] of Object.entries(ENTERPRISE_SECURITY_HEADERS)) {
    response.headers.set(header, value);
  }
  return response;
}

const PUBLIC_EXACT_ROUTES = ['/'];
const PUBLIC_PREFIX_ROUTES = [
  '/login',
  '/signup',
  '/auth/callback',
  '/api/rates',
  '/api/exchange-rates',
  '/api/mineral-prices',
  '/api/market-sync',
  '/markets',
  '/opportunities',
  '/map',
  '/services',
  '/verification',
  '/pricing',
  '/faq',
];
const AUTH_ONLY_ROUTES = ['/login', '/signup'];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return applySecurityHeaders(supabaseResponse);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // 1. Dual-Token Verification: Re-validate JWT token against Supabase Auth server
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isPublicRoute =
    PUBLIC_EXACT_ROUTES.includes(pathname) ||
    PUBLIC_PREFIX_ROUTES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

  const isAuthPage = AUTH_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const isAdminPageRoute =
    pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApiRoute =
    pathname === '/api/admin' || pathname.startsWith('/api/admin/');

  // 2. Strict Route Guardrails for `/admin/*` and `/api/admin/*`
  if (isAdminPageRoute || isAdminApiRoute) {
    if (!user) {
      if (
        isAdminApiRoute ||
        request.headers.get('accept')?.includes('application/json')
      ) {
        return applySecurityHeaders(
          NextResponse.json(
            {
              error: '403 Forbidden: Administrative authentication required.',
              code: 'ADMIN_AUTH_REQUIRED',
            },
            { status: 403 }
          )
        );
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', pathname);
      loginUrl.searchParams.set('reason', 'admin_auth_required');
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }

    // Explicitly query `public.user_profiles` (and fallback `public.users`) for `role === 'admin'`
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, status')
      .eq('id', user.id)
      .single();

    let resolvedRole = profile?.role;
    let resolvedStatus = profile?.status ?? 'active';

    if (!resolvedRole) {
      const { data: legacyUser } = await supabase
        .from('users')
        .select('role, status')
        .eq('id', user.id)
        .single();
      resolvedRole = legacyUser?.role;
      resolvedStatus = legacyUser?.status ?? resolvedStatus;
    }

    const isSuspended = resolvedStatus === 'suspended';

    if (resolvedRole !== 'admin' || isSuspended) {
      // Non-blocking audit log of unauthorized admin access attempt
      const forwardedFor = request.headers.get('x-forwarded-for');
      const clientIp = forwardedFor
        ? forwardedFor.split(',')[0].trim()
        : request.headers.get('x-real-ip') || '0.0.0.0';

      void supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'UNAUTHORIZED_ADMIN_ATTEMPT',
        ip_address: clientIp,
        user_agent: request.headers.get('user-agent') || 'Edge-Middleware',
        metadata: {
          attemptedPath: pathname,
          method: request.method,
          resolvedRole: resolvedRole ?? 'user',
          status: resolvedStatus,
        },
      });

      if (
        isAdminApiRoute ||
        request.headers.get('accept')?.includes('application/json')
      ) {
        return applySecurityHeaders(
          NextResponse.json(
            {
              error: '403 Forbidden: Explicit administrative privilege required.',
              code: 'INSUFFICIENT_PRIVILEGES',
            },
            { status: 403 }
          )
        );
      }

      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('error', 'forbidden_admin_access');
      return applySecurityHeaders(NextResponse.redirect(loginUrl, { status: 303 }));
    }

    return applySecurityHeaders(supabaseResponse);
  }

  // 3. Protect authenticated user routes (`/dashboard/*`, `/vault/*`)
  if (!isPublicRoute && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    loginUrl.searchParams.set('reason', 'membership_required');
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  // 4. Redirect already-authenticated members away from `/login` and `/signup`
  if (isAuthPage && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return applySecurityHeaders(NextResponse.redirect(dashboardUrl));
  }

  return applySecurityHeaders(supabaseResponse);
}
