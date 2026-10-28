import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * PUBLIC_ROUTES: Only the landing page, authentication pages, and public exchange rate API
 * are accessible without an active authenticated session.
 * All other routes (e.g., /dashboard, /list-a-project, /request-quote, /services, /opportunities)
 * sit behind a mandatory membership authentication wall.
 */
const PUBLIC_EXACT_ROUTES = ['/'];
const PUBLIC_PREFIX_ROUTES = ['/login', '/signup', '/auth/callback', '/api/rates'];
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

  // 1. Mandatory Membership Wall: Intercept any unauthenticated request to non-public routes
  //    (including /list-a-project, /request-quote, /dashboard, /services, etc.)
  if (!isPublicRoute && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    loginUrl.searchParams.set('reason', 'membership_required');
    return NextResponse.redirect(loginUrl);
  }

  // 2. Redirect already-authenticated members away from /login and /signup to /dashboard
  if (isAuthPage && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}
