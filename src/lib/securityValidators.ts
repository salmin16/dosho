/**
 * Enterprise Zero-Trust Input Validation & Payload Sanitization Engine
 * Provides strict Zod-compatible schema validation, XSS stripping, SQLi/PostgREST
 * filter-injection guards, and numeric/UUID boundary enforcement across all
 * Server Actions, API Routes, and Client/Database mutations.
 */

export interface ValidationIssue {
  path: string;
  message: string;
}

export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { message: string; issues: ValidationIssue[] } };

/**
 * Strips dangerous HTML/script tags, inline JS event handlers, and control characters
 * to prevent stored or reflected Cross-Site Scripting (XSS).
 */
export function sanitizeString(raw: unknown, maxLength = 5000): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // Strip control chars
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '') // Strip <script> blocks
    .replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '') // Strip <iframe> blocks
    .replace(/<\s*object[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, '') // Strip <object> blocks
    .replace(/<\/?[a-z][^>]*>/gi, '') // Strip remaining HTML tags
    .replace(/javascript\s*:/gi, '') // Strip javascript: URI schemes
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    .replace(/\bon[a-z]+\s*=/gi, '') // Strip inline on*= event attributes
    .trim()
    .slice(0, maxLength);
}

/**
 * Detects classic SQL injection or PostgREST operator tampering patterns in untrusted input
 */
const SQLI_TAMPER_PATTERNS: RegExp[] = [
  /(\b(UNION\s+ALL\s+SELECT|UNION\s+SELECT|DROP\s+TABLE|ALTER\s+TABLE|TRUNCATE\s+TABLE|INSERT\s+INTO|DELETE\s+FROM)\b)/i,
  /(--\s|\/\*[\s\S]*?\*\/|;\s*(DROP|ALTER|DELETE|UPDATE|INSERT)\b)/i,
  /(\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?)/i,
  /(\bpg_sleep\s*\(|\bwaitfor\s+delay\b|\bxp_cmdshell\b)/i,
];

export function hasInjectionSignature(input: string): boolean {
  return SQLI_TAMPER_PATTERNS.some((pattern) => pattern.test(input));
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{3,80}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidUuidOrRecordId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  return UUID_REGEX.test(trimmed) || SAFE_ID_REGEX.test(trimmed);
}

/**
 * Lightweight, strict Zod-compatible schema builder (`z`) for zero-trust validation
 */
class SchemaType<T> {
  private readonly validator: (val: unknown, path: string) => SafeParseResult<T>;

  constructor(validator: (val: unknown, path: string) => SafeParseResult<T>) {
    this.validator = validator;
  }

  safeParse(val: unknown, path = 'root'): SafeParseResult<T> {
    return this.validator(val, path);
  }

  parse(val: unknown): T {
    const res = this.safeParse(val);
    if (!res.success) {
      throw new Error(res.error.message);
    }
    return res.data;
  }
}

export const z = {
  string(opts?: {
    min?: number;
    max?: number;
    email?: boolean;
    fieldLabel?: string;
    rejectInjection?: boolean;
  }) {
    const min = opts?.min ?? 0;
    const max = opts?.max ?? 5000;
    const label = opts?.fieldLabel ?? 'Field';
    const rejectInjection = opts?.rejectInjection ?? true;

    return new SchemaType<string>((val, path) => {
      if (typeof val !== 'string') {
        return {
          success: false,
          error: {
            message: `${label} must be a valid string.`,
            issues: [{ path, message: `${label} must be a string.` }],
          },
        };
      }

      if (rejectInjection && hasInjectionSignature(val)) {
        return {
          success: false,
          error: {
            message: `Security Violation: Potentially unsafe query/script syntax rejected in ${label}.`,
            issues: [{ path, message: 'Unsafe payload signature detected.' }],
          },
        };
      }

      const cleaned = sanitizeString(val, max);
      if (cleaned.length < min) {
        return {
          success: false,
          error: {
            message: `${label} must be at least ${min} characters.`,
            issues: [{ path, message: `Minimum length is ${min}.` }],
          },
        };
      }

      if (opts?.email && !EMAIL_REGEX.test(cleaned.toLowerCase())) {
        return {
          success: false,
          error: {
            message: `${label} must be a valid email address.`,
            issues: [{ path, message: 'Invalid email format.' }],
          },
        };
      }

      return {
        success: true,
        data: opts?.email ? cleaned.toLowerCase() : cleaned,
      };
    });
  },

  number(opts?: { min?: number; max?: number; fieldLabel?: string }) {
    const min = opts?.min ?? 0;
    const max = opts?.max ?? 1_000_000_000_000;
    const label = opts?.fieldLabel ?? 'Numeric value';

    return new SchemaType<number>((val, path) => {
      const num = typeof val === 'number' ? val : Number(val);
      if (!Number.isFinite(num)) {
        return {
          success: false,
          error: {
            message: `${label} must be a valid finite number.`,
            issues: [{ path, message: 'Expected finite number.' }],
          },
        };
      }
      if (num < min || num > max) {
        return {
          success: false,
          error: {
            message: `${label} must be between ${min.toLocaleString()} and ${max.toLocaleString()}.`,
            issues: [{ path, message: `Out of bounds (${min}..${max}).` }],
          },
        };
      }
      return { success: true, data: num };
    });
  },

  boolean(opts?: { mustBeTrue?: boolean; message?: string }) {
    return new SchemaType<boolean>((val, path) => {
      if (typeof val !== 'boolean') {
        return {
          success: false,
          error: {
            message: opts?.message ?? 'Expected boolean value.',
            issues: [{ path, message: 'Expected boolean.' }],
          },
        };
      }
      if (opts?.mustBeTrue && val !== true) {
        return {
          success: false,
          error: {
            message:
              opts.message ?? 'Mandatory compliance confirmation is required.',
            issues: [{ path, message: opts.message ?? 'Must be true.' }],
          },
        };
      }
      return { success: true, data: val };
    });
  },

  enum<T extends string>(allowed: readonly T[], fieldLabel = 'Selection') {
    return new SchemaType<T>((val, path) => {
      if (typeof val !== 'string' || !allowed.includes(val as T)) {
        return {
          success: false,
          error: {
            message: `Invalid ${fieldLabel}. Allowed values: ${allowed.join(', ')}.`,
            issues: [{ path, message: `Invalid enum value for ${fieldLabel}.` }],
          },
        };
      }
      return { success: true, data: val as T };
    });
  },

  stringArray(opts?: { maxItems?: number; maxItemLength?: number; fieldLabel?: string }) {
    const maxItems = opts?.maxItems ?? 25;
    const maxItemLength = opts?.maxItemLength ?? 300;
    const label = opts?.fieldLabel ?? 'List';

    return new SchemaType<string[]>((val, path) => {
      if (!Array.isArray(val)) {
        return {
          success: false,
          error: {
            message: `${label} must be an array of strings.`,
            issues: [{ path, message: 'Expected array.' }],
          },
        };
      }
      const sanitized = val
        .slice(0, maxItems)
        .map((item) => sanitizeString(item, maxItemLength))
        .filter(Boolean);
      return { success: true, data: sanitized };
    });
  },

  object<Shape extends Record<string, SchemaType<unknown>>>(shape: Shape) {
    type Output = {
      [K in keyof Shape]: Shape[K] extends SchemaType<infer U> ? U : never;
    };

    return new SchemaType<Output>((val, path) => {
      if (typeof val !== 'object' || val === null || Array.isArray(val)) {
        return {
          success: false,
          error: {
            message: 'Invalid request payload: expected JSON object.',
            issues: [{ path, message: 'Expected object.' }],
          },
        };
      }

      const record = val as Record<string, unknown>;
      const output: Record<string, unknown> = {};
      const issues: ValidationIssue[] = [];

      for (const key of Object.keys(shape)) {
        const schema = shape[key];
        const res = schema.safeParse(record[key], key);
        if (!res.success) {
          issues.push(...res.error.issues);
        } else {
          output[key] = res.data;
        }
      }

      if (issues.length > 0) {
        return {
          success: false,
          error: {
            message: issues[0].message,
            issues,
          },
        };
      }

      return { success: true, data: output as Output };
    });
  },
};

// ============================================================================
// Domain Validation Schemas
// ============================================================================

export const AuthLoginSchema = z.object({
  email: z.string({ min: 5, max: 160, email: true, fieldLabel: 'Email address' }),
  password: z.string({
    min: 6,
    max: 128,
    fieldLabel: 'Password',
    rejectInjection: false,
  }),
});

export const AuthSignupSchema = z.object({
  email: z.string({ min: 5, max: 160, email: true, fieldLabel: 'Email address' }),
  password: z.string({
    min: 8,
    max: 128,
    fieldLabel: 'Password',
    rejectInjection: false,
  }),
  fullName: z.string({ min: 2, max: 120, fieldLabel: 'Full name' }),
});

export const OpportunitySubmissionSchema = z.object({
  title: z.string({ min: 5, max: 200, fieldLabel: 'Opportunity title' }),
  organization: z.string({ min: 2, max: 160, fieldLabel: 'Organization name' }),
  category: z.enum(
    [
      'Tender',
      'Consultancy',
      'Grant',
      'Internship',
      'Joint Venture',
      'Equipment Supply',
    ] as const,
    'Opportunity category'
  ),
  location: z.string({ min: 2, max: 120, fieldLabel: 'Regional location (Mkoa)' }),
  deadline: z.string({ min: 8, max: 40, fieldLabel: 'Submission deadline' }),
  compensationUsd: z.number({
    min: 0,
    max: 500_000_000,
    fieldLabel: 'Estimated value (USD)',
  }),
  description: z.string({ min: 20, max: 4000, fieldLabel: 'Scope description' }),
  requirements: z.stringArray({
    maxItems: 20,
    maxItemLength: 240,
    fieldLabel: 'Requirements',
  }),
  verifiedComplianceChecklist: z.boolean({
    mustBeTrue: true,
    message:
      'All statutory & anti-fraud verification checklist items must be confirmed before publishing.',
  }),
});

export const ServiceSubmissionSchema = z.object({
  serviceName: z.string({ min: 5, max: 200, fieldLabel: 'Service title' }),
  providerOrganization: z.string({
    min: 2,
    max: 160,
    fieldLabel: 'Provider organization',
  }),
  expertiseArea: z.enum(
    [
      'Geological & Exploration',
      'Drilling & Core Recovery',
      'Assay & Laboratory Testing',
      'Legal, Licensing & Cadastre',
      'Environmental (ESIA) & ESG',
      'Mine Engineering & EPCM',
    ] as const,
    'Expertise area'
  ),
  regionalCoverage: z.string({
    min: 2,
    max: 200,
    fieldLabel: 'Regional coverage',
  }),
  rateOrPricingModel: z.string({
    min: 2,
    max: 160,
    fieldLabel: 'Rate or pricing model',
  }),
  estimatedRateUsd: z.number({
    min: 0,
    max: 50_000_000,
    fieldLabel: 'Indicative rate (USD)',
  }),
  scopeDescription: z.string({
    min: 20,
    max: 4000,
    fieldLabel: 'Technical scope description',
  }),
  portfolioLinks: z.string({
    min: 0,
    max: 500,
    fieldLabel: 'Portfolio reference link',
  }),
  certifications: z.string({
    min: 0,
    max: 500,
    fieldLabel: 'Certifications & accreditations',
  }),
  verifiedComplianceChecklist: z.boolean({
    mustBeTrue: true,
    message:
      'All service verification and fee-disclosure checklist items must be confirmed before publishing.',
  }),
});

export const ProjectListingSchema = z.object({
  title: z.string({ min: 5, max: 200, fieldLabel: 'Project title' }),
  mineral: z.string({ min: 2, max: 80, fieldLabel: 'Primary mineral' }),
  region: z.string({ min: 2, max: 80, fieldLabel: 'Tanzanian region (Mkoa)' }),
  licenceType: z.string({ min: 2, max: 120, fieldLabel: 'Licence category' }),
  licenceReference: z.string({
    min: 3,
    max: 100,
    fieldLabel: 'Mining Commission licence reference',
  }),
  investmentUsd: z.number({
    min: 1000,
    max: 10_000_000_000,
    fieldLabel: 'Capital sought (USD)',
  }),
  summary: z.string({ min: 15, max: 4000, fieldLabel: 'Geological & transaction summary' }),
});

export const AdminMineralPriceSchema = z.object({
  id: z.string({ min: 3, max: 80, fieldLabel: 'Mineral record ID' }),
  world_market_price_usd: z.number({
    min: 0.01,
    max: 5_000_000,
    fieldLabel: 'World market spot price (USD)',
  }),
  local_market_price_usd: z.number({
    min: 0.01,
    max: 5_000_000,
    fieldLabel: 'Local mineral market price (USD)',
  }),
  buying_centre_price_usd: z.number({
    min: 0.01,
    max: 5_000_000,
    fieldLabel: 'Buying centre price (USD)',
  }),
  trend_percentage: z.number({
    min: -95,
    max: 500,
    fieldLabel: '24h trend percentage',
  }),
});

export const VaultDocumentSchema = z.object({
  title: z.string({ min: 3, max: 180, fieldLabel: 'Document title' }),
  content: z.string({ min: 5, max: 10000, fieldLabel: 'Document content' }),
  classification: z.enum(
    ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'] as const,
    'Security classification'
  ),
});
