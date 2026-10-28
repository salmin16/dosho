import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { signOutAction } from '@/app/auth/actions';
import DocumentManager from './DocumentManager';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();

  // 1. Verify authenticated user directly against Supabase Auth server
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // 2. Fetch the user's profile and grounded documents concurrently.
  // Both queries are enforced at the database layer via PostgreSQL RLS
  // (`USING (auth.uid() = id)` and `USING (auth.uid() = user_id)`) AND
  // explicitly scoped with `.eq()` for defense-in-depth.
  const [{ data: profile }, { data: documents }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
    supabase
      .from('user_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
            <span className="font-semibold tracking-tight text-white">
              Enterprise Grounded Workspace
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right text-xs">
              <p className="font-medium text-slate-200">
                {profile?.full_name || user.email}
              </p>
              <p className="font-mono text-[11px] text-slate-400">
                UUID: {user.id}
              </p>
            </div>

            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        {/* Security Context Banner */}
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">
                Welcome back, {profile?.full_name || user.email}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                All queries in this Server Component execute with your scoped JWT session. PostgreSQL Row-Level Security guarantees zero cross-tenant data leakage.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-mono text-slate-300">
              <div>Role: <span className="text-emerald-400">{user.role}</span></div>
              <div>RLS Policy: <span className="text-indigo-400">auth.uid() = user_id</span></div>
            </div>
          </div>
        </div>

        {/* Interactive Grounded Document Manager */}
        <DocumentManager initialDocuments={documents ?? []} />
      </main>
    </div>
  );
}
