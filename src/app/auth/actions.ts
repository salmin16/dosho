'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { logActivity } from '@/utils/audit-logger';
import { validateStrongPassword } from '@/lib/validations/auth';

export interface AuthActionResponse {
  error?: string;
  success?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeRedirectPath(nextPath: string | null | undefined): string {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return '/dashboard';
  }
  return nextPath;
}

export async function loginAction(
  formData: FormData
): Promise<AuthActionResponse> {
  const email = (formData.get('email') as string | null)?.trim() ?? '';
  const password = (formData.get('password') as string | null) ?? '';
  const nextPath = sanitizeRedirectPath(formData.get('next') as string | null);

  if (!email || !EMAIL_REGEX.test(email)) {
    return { error: 'Please provide a valid email address.' };
  }

  if (!password) {
    return { error: 'Password is required.' };
  }

  const supabase = await createClient();

  // Instant Sign-In: returning users authenticate directly via Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    logActivity({
      action: 'LOGIN_FAILED',
      metadata: { email, reason: error?.message ?? 'Invalid credentials' },
    });
    return { error: error?.message || 'Invalid email or password. Please try again.' };
  }

  logActivity({
    userId: data.user.id,
    action: 'LOGIN_SUCCESS',
    metadata: { email: data.user.email, redirect: nextPath },
  });

  revalidatePath('/', 'layout');
  redirect(nextPath);
}

export async function signupAction(
  formData: FormData
): Promise<AuthActionResponse> {
  const email = (formData.get('email') as string | null)?.trim() ?? '';
  const password = (formData.get('password') as string | null) ?? '';
  const confirmPassword =
    (formData.get('confirmPassword') as string | null) ?? '';
  const fullName =
    (formData.get('fullName') as string | null)?.trim() || email.split('@')[0];
  const captchaToken =
    ((formData.get('captchaToken') as string | null) ||
      (formData.get('cf-turnstile-response') as string | null) ||
      '').trim();

  if (!email || !EMAIL_REGEX.test(email)) {
    return { error: 'Please enter a valid email address.' };
  }

  const passwordError = validateStrongPassword(password);
  if (passwordError) {
    return { error: passwordError };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // Only include captchaToken when Turnstile actually returned one (non-blocking fail-open)
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
      ...(captchaToken ? { captchaToken } : {}),
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    logActivity({
      userId: data.user.id,
      action: 'SIGNUP_SUCCESS',
      metadata: { email: data.user.email },
    });
  }

  if (data.session) {
    revalidatePath('/', 'layout');
    redirect('/dashboard');
  }

  return {
    success:
      'Account created! Please check your email inbox to confirm your account before signing in.',
  };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    logActivity({
      userId: user.id,
      action: 'LOGOUT',
      metadata: { email: user.email },
    });
  }

  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
