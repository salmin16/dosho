import { z } from '../securityValidators';

/**
 * Enterprise Strong Password Policy & Auth Validation Schemas (`src/lib/validations/auth.ts`)
 * Enforced identically on client UI, Supabase Auth flows, and server actions:
 * - 8 to 64 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 number (0-9)
 * - At least 1 special character / symbol
 */

export const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{}|;':",./<>?]/;
export const UPPERCASE_REGEX = /[A-Z]/;
export const LOWERCASE_REGEX = /[a-z]/;
export const NUMBER_REGEX = /[0-9]/;

export interface PasswordRuleResult {
  id: 'length' | 'uppercase' | 'lowercase' | 'number' | 'special';
  label: string;
  passed: boolean;
}

export interface PasswordStrengthEvaluation {
  rules: PasswordRuleResult[];
  score: number; // 0..5
  isValid: boolean;
  label: 'Empty' | 'Weak' | 'Fair' | 'Good' | 'Strong';
}

export function evaluatePasswordRules(password: string): PasswordStrengthEvaluation {
  const rules: PasswordRuleResult[] = [
    {
      id: 'length',
      label: '8–64 characters',
      passed: password.length >= 8 && password.length <= 64,
    },
    {
      id: 'uppercase',
      label: 'At least 1 uppercase letter (A–Z)',
      passed: UPPERCASE_REGEX.test(password),
    },
    {
      id: 'lowercase',
      label: 'At least 1 lowercase letter (a–z)',
      passed: LOWERCASE_REGEX.test(password),
    },
    {
      id: 'number',
      label: 'At least 1 number (0–9)',
      passed: NUMBER_REGEX.test(password),
    },
    {
      id: 'special',
      label: 'At least 1 special symbol (!@#$%^&*...)',
      passed: SPECIAL_CHAR_REGEX.test(password),
    },
  ];

  const score = rules.filter((r) => r.passed).length;
  const isValid = score === rules.length;

  let label: PasswordStrengthEvaluation['label'] = 'Empty';
  if (password.length > 0) {
    if (score <= 2) label = 'Weak';
    else if (score === 3) label = 'Fair';
    else if (score === 4) label = 'Good';
    else label = 'Strong';
  }

  return { rules, score, isValid, label };
}

export function validateStrongPassword(password: string): string | null {
  if (password.length < 8 || password.length > 64) {
    return 'Password must be between 8 and 64 characters long.';
  }
  if (!UPPERCASE_REGEX.test(password)) {
    return 'Password must contain at least one uppercase letter (A–Z).';
  }
  if (!LOWERCASE_REGEX.test(password)) {
    return 'Password must contain at least one lowercase letter (a–z).';
  }
  if (!NUMBER_REGEX.test(password)) {
    return 'Password must contain at least one number (0–9).';
  }
  if (!SPECIAL_CHAR_REGEX.test(password)) {
    return 'Password must contain at least one special character (e.g. !@#$%^&*).';
  }
  return null;
}

export const BaseSignUpSchema = z.object({
  fullName: z.string({ min: 0, max: 120, fieldLabel: 'Full name' }),
  email: z.string({ min: 5, max: 160, email: true, fieldLabel: 'Email address' }),
  password: z.string({
    min: 8,
    max: 64,
    fieldLabel: 'Password',
    rejectInjection: false,
  }),
  confirmPassword: z.string({
    min: 8,
    max: 64,
    fieldLabel: 'Confirm password',
    rejectInjection: false,
  }),
});

export function validateSignUpPayload(input: {
  fullName?: string;
  email: string;
  password: string;
  confirmPassword: string;
}): { success: true; data: { fullName: string; email: string; password: string } } | { success: false; error: string } {
  const parsed = BaseSignUpSchema.safeParse({
    fullName: input.fullName?.trim() || '',
    email: input.email.trim(),
    password: input.password,
    confirmPassword: input.confirmPassword,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.message };
  }

  const pwdError = validateStrongPassword(parsed.data.password);
  if (pwdError) {
    return { success: false, error: pwdError };
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { success: false, error: 'Passwords do not match.' };
  }

  return {
    success: true,
    data: {
      fullName: parsed.data.fullName || parsed.data.email.split('@')[0],
      email: parsed.data.email,
      password: parsed.data.password,
    },
  };
}

export const LoginPayloadSchema = z.object({
  email: z.string({ min: 5, max: 160, email: true, fieldLabel: 'Email address' }),
  password: z.string({
    min: 1,
    max: 128,
    fieldLabel: 'Password',
    rejectInjection: false,
  }),
});
