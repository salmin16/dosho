'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export interface AuthActionResponse {
  error?: string;
  success?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates that a post-login redirect path is strictly a relative internal path
 * to prevent Open Redirect vulnerabilities.
 */
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

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Return a generic message for invalid credentials to prevent user enumeration
    return { error: 'Invalid email or password. Please try again.' };
  }

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

  if (!email || !EMAIL_REGEX.test(email)) {
    return { error: 'Please enter a valid email address.' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters long.' };
  }

  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      error:
        'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
    };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // If email confirmation is disabled in Supabase, session is established immediately
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
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
