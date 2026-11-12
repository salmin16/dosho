import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { signOutAction } from '@/app/auth/actions';
import { CurrencyProvider } from '@/context/CurrencyContext';
import CurrencySelector from '@/components/CurrencySelector';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Defense-in-Depth: Server Component layout verification in addition to middleware.ts
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login?next=/admin&reason=admin_auth_required');
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, role, status')
    .eq('id', user.id)
    .single();

  const jwtRole =
    (user.app_metadata?.role as string | undefined) ||
    (user.user_metadata?.role as string | undefined);
  const effectiveRole = profile?.role ?? jwtRole;

  if (effectiveRole !== 'admin' || profile?.status === 'suspended') {
    redirect('/dashboard?error=forbidden_admin_access');
  }

  return (
    <CurrencyProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {/* Top Security Governance Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                </span>
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  DOSHO SECURITY &amp; GOVERNANCE CONSOLE
                </span>
              </div>
              <span className="hidden rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 sm:inline-block">
                CLEARANCE: ADMIN
              </span>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <CurrencySelector compact />

              <Link
                href="/dashboard"
                className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Member Workspace
              </Link>

              <div className="hidden text-right text-xs md:block">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {profile?.full_name || user.email}
                </p>
                <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                  {user.email}
                </p>
              </div>

              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-400"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Main Dashboard Container */}
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </div>
    </CurrencyProvider>
  );
}
