/**
 * Enterprise Environment Variable & Secret Hygiene Guard
 * Ensures zero private keys, Supabase service_role keys, or database credentials
 * are ever exposed via `NEXT_PUBLIC_*` or `VITE_*` client-side prefixes.
 */

const FORBIDDEN_PUBLIC_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_DATABASE_URL',
  'VITE_DATABASE_URL',
  'NEXT_PUBLIC_JWT_SECRET',
  'VITE_JWT_SECRET',
  'NEXT_PUBLIC_PRIVATE_KEY',
  'VITE_PRIVATE_KEY',
  'NEXT_PUBLIC_METALS_API_KEY',
  'VITE_METALS_API_SECRET',
  'NEXT_PUBLIC_MERCHANT_BANK_NAME',
  'VITE_MERCHANT_BANK_NAME',
  'NEXT_PUBLIC_MERCHANT_ACCOUNT_NUMBER',
  'VITE_MERCHANT_ACCOUNT_NUMBER',
  'NEXT_PUBLIC_MERCHANT_ACCOUNT_NAME',
  'VITE_MERCHANT_ACCOUNT_NAME',
  'NEXT_PUBLIC_STRIPE_SECRET_KEY',
  'VITE_STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_AZAMPAY_CLIENT_SECRET',
  'NEXT_PUBLIC_FLUTTERWAVE_SECRET_KEY',
] as const;

export interface SecurityEnvStatus {
  supabaseConfigured: boolean;
  secretHygienePassed: boolean;
  exposedSecretsDetected: string[];
  environment: 'production' | 'development' | 'test';
}

/**
 * Inspects exposed client environment keys to verify that no privileged server
 * secrets (`SERVICE_ROLE`, `DATABASE_URL`, `PRIVATE_KEY`) were accidentally
 * prefixed with `NEXT_PUBLIC_` or `VITE_`.
 */
export function verifyEnvironmentSecretHygiene(): SecurityEnvStatus {
  const metaEnv =
    (import.meta as unknown as { env?: Record<string, string | undefined> })
      .env ?? {};
  const procEnv =
    typeof process !== 'undefined' && process.env ? process.env : {};

  const combinedKeys = new Set([
    ...Object.keys(metaEnv),
    ...Object.keys(procEnv),
  ]);

  const exposedSecretsDetected: string[] = [];

  for (const key of combinedKeys) {
    const upperKey = key.toUpperCase();
    const isClientExposedPrefix =
      upperKey.startsWith('NEXT_PUBLIC_') || upperKey.startsWith('VITE_');

    if (
      isClientExposedPrefix &&
      (FORBIDDEN_PUBLIC_ENV_KEYS.includes(
        upperKey as (typeof FORBIDDEN_PUBLIC_ENV_KEYS)[number]
      ) ||
        upperKey.includes('SERVICE_ROLE') ||
        upperKey.includes('PRIVATE_KEY') ||
        upperKey.includes('DATABASE_URL') ||
        upperKey.includes('DB_PASSWORD'))
    ) {
      const val = metaEnv[key] || procEnv[key];
      if (val && val.trim().length > 0) {
        exposedSecretsDetected.push(key);
      }
    }
  }

  const supabaseUrl =
    metaEnv.VITE_SUPABASE_URL ||
    metaEnv.NEXT_PUBLIC_SUPABASE_URL ||
    procEnv.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    metaEnv.VITE_SUPABASE_ANON_KEY ||
    metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    procEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    supabaseConfigured: Boolean(
      supabaseUrl &&
        supabaseAnonKey &&
        !supabaseUrl.includes('your-project-id')
    ),
    secretHygienePassed: exposedSecretsDetected.length === 0,
    exposedSecretsDetected,
    environment:
      metaEnv.MODE === 'production' || procEnv.NODE_ENV === 'production'
        ? 'production'
        : 'development',
  };
}
