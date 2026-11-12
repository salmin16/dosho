import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * PUBLIC_ROUTES: Only the landing page, authentication pages, and public exchange rate APIs
 * are accessible without an active authenticated session.
 */
const PUBLIC_EXACT_ROUTES = ['/'];
const PUBLIC_PREFIX_ROUTES = [
  '/login',
  '/signup',
  '/auth/callback',
  '/api/rates',
  '/api/exchange-rates',
];
const AUTH_ONLY_ROUTES = ['/login', '/signup'];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

  // SECURITY CRITICAL: Re-validate JWT token against Supabase Auth server
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

  // 1. Intercept all /admin/* and /api/admin/* routes for strict RBAC verification
  if (isAdminPageRoute || isAdminApiRoute) {
    if (!user) {
      if (isAdminApiRoute) {
        return NextResponse.json(
          { error: 'Unauthorized: Valid authentication session required.' },
          { status: 401 }
        );
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', pathname);
      loginUrl.searchParams.set('reason', 'admin_auth_required');
      return NextResponse.redirect(loginUrl);
    }

    // Verify role from user_profiles table in PostgreSQL (and check account status)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, status')
      .eq('id', user.id)
      .single();

    const jwtRole =
      (user.app_metadata?.role as string | undefined) ||
      (user.user_metadata?.role as string | undefined);
    const effectiveRole = profile?.role ?? jwtRole;
    const isSuspended = profile?.status === 'suspended';

    if (effectiveRole !== 'admin' || isSuspended) {
      // Return strict 403 Forbidden for API routes or when requested
      if (isAdminApiRoute) {
        return NextResponse.json(
          {
            error: 'Forbidden: Administrative clearance required.',
            code: 'INSUFFICIENT_PRIVILEGES',
          },
          { status: 403 }
        );
      }

      const forbiddenUrl = request.nextUrl.clone();
      forbiddenUrl.pathname = '/dashboard';
      forbiddenUrl.searchParams.set('error', 'forbidden_admin_access');
      return NextResponse.redirect(forbiddenUrl, { status: 303 });
    }

    return supabaseResponse;
  }

  // 2. Mandatory Membership Wall: Intercept any unauthenticated request to non-public routes
  if (!isPublicRoute && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    loginUrl.searchParams.set('reason', 'membership_required');
    return NextResponse.redirect(loginUrl);
  }

  // 3. Redirect already-authenticated members away from /login and /signup to /dashboard
  if (isAuthPage && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}
