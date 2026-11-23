'use client';

import React, { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Info } from 'lucide-react';
import { signupAction } from '@/app/auth/actions';
import { validateSignUpPayload } from '@/lib/validations/auth';
import PasswordStrengthChecklist from '@/components/PasswordStrengthChecklist';
import TurnstileWidget, {
  isTurnstileEnabled,
  type TurnstileWidgetHandle,
} from '@/components/TurnstileWidget';

export default function SignUpPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaNotice, setCaptchaNotice] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const turnstileRef = useRef<TurnstileWidgetHandle | null>(null);
  const turnstileEnabled = isTurnstileEnabled();

  // Never permanently disable the button while Turnstile initializes or is unconfigured
  const isSubmitDisabled =
    isPending || !email.trim() || !password || !confirmPassword;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setClientError(null);
    setServerError(null);
    setSuccessMessage(null);
    setCaptchaNotice(null);

    const validation = validateSignUpPayload({
      fullName,
      email,
      password,
      confirmPassword,
    });
    if (!validation.success) {
      setClientError(validation.error);
      return;
    }

    if (turnstileEnabled && !captchaToken) {
      setCaptchaNotice(
        'Completing security check — please wait a moment or refresh if blocked by an ad blocker.'
      );
      return;
    }

    const formData = new FormData(e.currentTarget);
    if (captchaToken) {
      formData.set('captchaToken', captchaToken);
    }

    startTransition(async () => {
      const result = await signupAction(formData);
      if (result?.error) {
        setServerError(result.error);
        setCaptchaToken('');
        turnstileRef.current?.reset();
      } else if (result?.success) {
        setSuccessMessage(result.success);
        setPassword('');
        setConfirmPassword('');
        setCaptchaToken('');
        turnstileRef.current?.reset();
      }
    });
  };

  const errorMessage = clientError || serverError;

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md space-y-7 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur sm:p-8">
        <div>
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20">
            Enterprise Security
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Provision an isolated workspace backed by PostgreSQL Row-Level Security.
          </p>
        </div>

        {captchaNotice && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-amber-500/35 bg-amber-500/10 p-4 text-sm text-amber-200"
          >
            <Info size={16} className="mt-0.5 shrink-0 text-amber-400" />
            <span>{captchaNotice}</span>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300"
          >
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <input type="hidden" name="captchaToken" value={captchaToken} />

          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-slate-300"
            >
              Full Name / Organization
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Salmin Mwenesi — Geita Holdings"
              className="mt-1.5 block min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-300"
            >
              Work Email
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
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8–64 chars (A-Z, a-z, 0-9, !@#$)"
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
            <PasswordStrengthChecklist
              password={password}
              confirmPassword={confirmPassword}
              dark
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-slate-300"
            >
              Confirm Password
            </label>
            <div className="relative mt-1.5">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your strong password"
                className="block min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 pr-12 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={
                  showConfirmPassword
                    ? 'Hide confirm password'
                    : 'Show confirm password'
                }
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:text-white"
              >
                {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <TurnstileWidget
            ref={turnstileRef}
            theme="dark"
            onVerify={(token) => {
              setCaptchaToken(token);
              setCaptchaNotice(null);
              setClientError(null);
            }}
            onExpire={() => setCaptchaToken('')}
            onError={(msg) => setCaptchaNotice(msg)}
          />

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#d97706] px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-amber-400 hover:text-amber-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
