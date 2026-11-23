'use client';

import React, { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { loginAction } from '@/app/auth/actions';
import TurnstileWidget, {
  isTurnstileEnabled,
  type TurnstileWidgetHandle,
} from '@/components/TurnstileWidget';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') ?? '/dashboard';
  const callbackError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(
    callbackError
  );
  const [isPending, startTransition] = useTransition();

  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const turnstileEnabled = isTurnstileEnabled();

  const canSubmit =
    !isPending &&
    email.trim().length > 0 &&
    password.length > 0 &&
    (!turnstileEnabled || Boolean(captchaToken));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email and password.');
      return;
    }

    if (turnstileEnabled && !captchaToken) {
      setErrorMessage(
        'Please complete the Cloudflare Turnstile security check before signing in.'
      );
      return;
    }

    const formData = new FormData(e.currentTarget);
    if (captchaToken) {
      formData.set('captchaToken', captchaToken);
    }

    startTransition(async () => {
      try {
        const result = await loginAction(formData);
        if (result?.error) {
          setErrorMessage(result.error);
        }
      } finally {
        setCaptchaToken('');
        turnstileRef.current?.reset();
      }
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md space-y-7 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur sm:p-8">
        <div>
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20">
            Authenticated Portal
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
            Sign in to your account
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Access your private, RLS-grounded workspace.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <input type="hidden" name="next" value={nextPath} />
          <input type="hidden" name="captchaToken" value={captchaToken} />

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-300"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="mt-1.5 block min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-300"
            >
              Password
            </label>
            <div className="relative mt-1.5">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 pr-12 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <TurnstileWidget
            ref={turnstileRef}
            theme="dark"
            onVerify={(token) => {
              setCaptchaToken(token);
              setErrorMessage(null);
            }}
            onExpire={() => setCaptchaToken('')}
            onError={(msg) => setErrorMessage(msg)}
          />

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#d97706] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="font-medium text-amber-400 hover:text-amber-300"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
