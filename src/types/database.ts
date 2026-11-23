export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SupportedCurrency =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'TZS'
  | 'JPY'
  | 'ZAR'
  | 'AUD'
  | 'CAD'
  | 'CNY'
  | 'AED';

export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended';
export type UserVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected';

export type DocumentClassification =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'RESTRICTED';

export type ContentStatus =
  | 'pending'
  | 'approved'
  | 'active'
  | 'hidden'
  | 'archived'
  | 'flagged'
  | 'rejected';

export type MineralCategory =
  | 'Precious Metals'
  | 'Base & Industrial Metals'
  | 'Critical & Battery Minerals'
  | 'Gemstones';

export type MarketFeedSource =
  | 'LIVE_API'
  | 'HYBRID_LIVE'
  | 'CACHED_BENCHMARK';

export interface MineralPriceRecord {
  id: string;
  mineral_name: string;
  symbol: string;
  category: MineralCategory;
  unit: string;
  local_statutory_unit?: string;
  purity_note: string;
  producing_regions?: string;
  world_market_price_usd: number;
  local_market_price_usd: number;
  buying_centre_price_usd: number;
  royalty_rate_pct: number;
  inspection_fee_pct?: number;
  trend_percentage: number;
  change_24h_usd?: number;
  day_open_usd?: number;
  day_high_usd?: number;
  day_low_usd?: number;
  exchange_desk?: string;
  feed_source?: MarketFeedSource;
  sparkline_points: number[];
  updated_at: string;
}

export interface MarketSyncTelemetry {
  syncId: string;
  provider: string;
  syncMode: MarketFeedSource;
  status: 'LIVE' | 'CACHED' | 'FALLBACK';
  latencyMs: number;
  commoditiesSynced: number;
  liveSymbols: string[];
  lastSyncedAt: string;
  nextSyncAt: string;
}

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'SIGNUP_SUCCESS'
  | 'UPDATE_SETTINGS'
  | 'CREATE_DOCUMENT'
  | 'DELETE_DOCUMENT'
  | 'LIST_PROJECT'
  | 'REQUEST_QUOTE'
  | 'CREATE_OPPORTUNITY'
  | 'CREATE_SERVICE'
  | 'ADMIN_UPDATE_ROLE'
  | 'ADMIN_SUSPEND_USER'
  | 'ADMIN_ACTIVATE_USER'
  | 'ADMIN_DELETE_USER'
  | 'ADMIN_APPROVE_SUBMISSION'
  | 'ADMIN_REJECT_SUBMISSION'
  | 'ADMIN_EDIT_CONTENT'
  | 'ADMIN_PURGE_CONTENT'
  | 'ADMIN_UPDATE_MINERAL_PRICE'
  | 'UNAUTHORIZED_ADMIN_ATTEMPT'
  | (string & {});

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  company_name?: string | null;
  phone?: string | null;
  role: UserRole;
  status: UserStatus;
  verification_status?: UserVerificationStatus;
  verification_notes?: string | null;
  verified_at?: string | null;
  verified_by?: string | null;
  preferred_currency?: SupportedCurrency;
  terms_accepted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type ComplianceComplaintCategory =
  | 'Unverified License'
  | 'Misleading Claim'
  | 'Fee Circumvention'
  | 'Privacy'
  | 'Other';

export type ComplianceComplaintStatus =
  | 'open'
  | 'investigating'
  | 'resolved'
  | 'dismissed';

export interface ComplianceComplaintRecord {
  id: string;
  reporter_user_id: string | null;
  reporter_email: string;
  category: ComplianceComplaintCategory;
  reference_code: string | null;
  description: string;
  status: ComplianceComplaintStatus;
  resolution_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminAuditLogRecord {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action_type: string;
  target_table: string;
  target_id: string | null;
  target_summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: AuditAction;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface UserDocument {
  id: string;
  user_id: string;
  title: string;
  content: string;
  classification: DocumentClassification;
  status?: ContentStatus;
  approved?: boolean;
  moderation_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserListedProject {
  id: string;
  user_id: string;
  title: string;
  mineral: string;
  region: string;
  licence_type: string;
  licence_reference: string;
  investment_usd: number;
  submitted_currency: SupportedCurrency;
  summary: string;
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'hidden'
    | 'PENDING_VERIFICATION'
    | 'VERIFIED'
    | 'ARCHIVED'
    | 'FLAGGED'
    | 'REJECTED';
  approved?: boolean;
  is_featured?: boolean;
  rejection_reason?: string | null;
  moderation_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteRequestRecord {
  id: string;
  user_id: string;
  provider_id: string;
  provider_name: string;
  service_requested: string;
  estimated_budget_usd: number;
  currency_code: SupportedCurrency;
  scope_notes: string;
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'hidden'
    | 'SUBMITTED'
    | 'QUOTED'
    | 'CLOSED'
    | 'FLAGGED'
    | 'REJECTED';
  approved?: boolean;
  is_featured?: boolean;
  rejection_reason?: string | null;
  moderation_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export type OpportunitySubmissionCategory =
  | 'Tender'
  | 'Consultancy'
  | 'Grant'
  | 'Internship'
  | 'Joint Venture'
  | 'Equipment Supply';

export interface UserOpportunityRecord {
  id: string;
  user_id: string;
  title: string;
  organization: string;
  category: OpportunitySubmissionCategory;
  location: string;
  deadline: string;
  compensation_usd: number;
  description: string;
  requirements: string[];
  reference_code: string;
  status: ContentStatus;
  approved: boolean;
  is_featured?: boolean;
  rejection_reason?: string | null;
  moderation_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type ServiceExpertiseArea =
  | 'Geological & Exploration'
  | 'Drilling & Core Recovery'
  | 'Assay & Laboratory Testing'
  | 'Legal, Licensing & Cadastre'
  | 'Environmental (ESIA) & ESG'
  | 'Mine Engineering & EPCM';

export interface UserServiceRecord {
  id: string;
  user_id: string;
  service_name: string;
  provider_organization: string;
  expertise_area: ServiceExpertiseArea;
  regional_coverage: string;
  rate_or_pricing_model: string;
  estimated_rate_usd: number;
  scope_description: string;
  portfolio_links: string;
  certifications: string;
  reference_code: string;
  status: ContentStatus;
  approved: boolean;
  is_featured?: boolean;
  rejection_reason?: string | null;
  moderation_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type UnifiedContentType =
  | 'DOCUMENT'
  | 'PROJECT'
  | 'QUOTE'
  | 'OPPORTUNITY'
  | 'SERVICE';

export type SubscriptionTierName =
  | 'Explorer'
  | 'Miner'
  | 'Professional'
  | 'Investor'
  | 'Corporate';

export type SubscriptionStatus = 'active' | 'expired' | 'canceled';
export type BillingCycle = 'monthly' | 'yearly';

export type PaymentGatewayId = 'FREE_TIER' | 'CLICKPESA';

export type ClickPesaRail =
  | 'FREE'
  | 'MOBILE_MONEY'
  | 'BANK_TRANSFER'
  | 'INTERNATIONAL_CARD';

export type ClickPesaProviderCode =
  | 'FREE'
  | 'MPESA_TZ'
  | 'AIRTEL_MONEY_TZ'
  | 'MIXX_BY_YAS'
  | 'HALOPESA_TZ'
  | 'EZYPESA_TZ'
  | 'CRDB_BANK'
  | 'NMB_BANK'
  | 'NBC_BANK'
  | 'VISA_CARD'
  | 'MASTERCARD'
  | 'UNIONPAY_CARD';

export type ClickPesaTransactionState =
  | 'INITIATED'
  | 'PROCESSING'
  | 'SETTLED'
  | 'FAILED';

export interface UserSubscriptionRecord {
  id: string;
  user_id: string;
  tier_name: SubscriptionTierName;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  price_tzs: number;
  price_usd: number;
  payment_gateway: PaymentGatewayId;
  payment_rail?: ClickPesaRail;
  payment_provider?: ClickPesaProviderCode | null;
  payment_reference: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransactionRecord {
  id: string;
  idempotency_key: string;
  clickpesa_order_id: string;
  clickpesa_control_number?: string | null;
  user_id: string;
  tier_name: SubscriptionTierName;
  billing_cycle: BillingCycle;
  gateway: PaymentGatewayId;
  rail: ClickPesaRail;
  provider_code: ClickPesaProviderCode;
  payment_method_label: string;
  account_or_phone_masked?: string | null;
  verified_amount_tzs: number;
  verified_amount_usd: number;
  charged_currency: SupportedCurrency;
  charged_amount: number;
  state: ClickPesaTransactionState;
  webhook_signature_verified: boolean;
  reconciled_at?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface UnifiedContentRecord {
  id: string;
  type: UnifiedContentType;
  user_id: string;
  owner_email: string;
  owner_name: string;
  owner_verified?: boolean;
  title: string;
  details: string;
  category_badge: string;
  reference_code: string;
  value_usd: number | null;
  status: ContentStatus;
  raw_status: string;
  approved: boolean;
  is_featured?: boolean;
  rejection_reason?: string | null;
  moderation_notes: string | null;
  created_at: string;
  updated_at: string;
}

type TableRow<T> = { [K in keyof T]: T[K] };

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: TableRow<UserProfile>;
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          company_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          status?: UserStatus;
          verification_status?: UserVerificationStatus;
          verification_notes?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          preferred_currency?: SupportedCurrency;
          terms_accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          company_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          status?: UserStatus;
          verification_status?: UserVerificationStatus;
          verification_notes?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          preferred_currency?: SupportedCurrency;
          terms_accepted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_audit_logs: {
        Row: TableRow<AdminAuditLogRecord>;
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_email?: string | null;
          action_type: string;
          target_table: string;
          target_id?: string | null;
          target_summary?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      mineral_prices: {
        Row: TableRow<MineralPriceRecord>;
        Insert: {
          id?: string;
          mineral_name: string;
          symbol: string;
          category?: MineralCategory;
          unit?: string;
          purity_note?: string;
          world_market_price_usd: number;
          local_market_price_usd: number;
          buying_centre_price_usd: number;
          royalty_rate_pct?: number;
          trend_percentage?: number;
          sparkline_points?: Json;
          updated_at?: string;
        };
        Update: {
          mineral_name?: string;
          symbol?: string;
          category?: MineralCategory;
          unit?: string;
          purity_note?: string;
          world_market_price_usd?: number;
          local_market_price_usd?: number;
          buying_centre_price_usd?: number;
          royalty_rate_pct?: number;
          trend_percentage?: number;
          change_24h_usd?: number;
          day_high_usd?: number;
          day_low_usd?: number;
          feed_source?: MarketFeedSource;
          sparkline_points?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: TableRow<UserProfile>;
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          company_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          status?: UserStatus;
          verification_status?: UserVerificationStatus;
          verification_notes?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          preferred_currency?: SupportedCurrency;
          terms_accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          company_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          status?: UserStatus;
          verification_status?: UserVerificationStatus;
          verification_notes?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          preferred_currency?: SupportedCurrency;
          terms_accepted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: TableRow<AuditLog>;
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          ip_address?: string | null;
          user_agent?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      user_documents: {
        Row: TableRow<UserDocument>;
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          content: string;
          classification?: DocumentClassification;
          status?: ContentStatus;
          approved?: boolean;
          moderation_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          content?: string;
          classification?: DocumentClassification;
          status?: ContentStatus;
          approved?: boolean;
          moderation_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_projects: {
        Row: TableRow<UserListedProject>;
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          mineral: string;
          region: string;
          licence_type: string;
          licence_reference: string;
          investment_usd: number;
          submitted_currency?: SupportedCurrency;
          summary: string;
          status?:
            | 'PENDING_VERIFICATION'
            | 'VERIFIED'
            | 'ARCHIVED'
            | 'FLAGGED'
            | 'REJECTED';
          approved?: boolean;
          moderation_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          summary?: string;
          investment_usd?: number;
          status?:
            | 'PENDING_VERIFICATION'
            | 'VERIFIED'
            | 'ARCHIVED'
            | 'FLAGGED'
            | 'REJECTED';
          approved?: boolean;
          moderation_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      quotes: {
        Row: TableRow<QuoteRequestRecord>;
        Insert: {
          id?: string;
          user_id?: string;
          provider_id: string;
          provider_name: string;
          service_requested: string;
          estimated_budget_usd: number;
          currency_code?: SupportedCurrency;
          scope_notes: string;
          status?: QuoteRequestRecord['status'];
          approved?: boolean;
          is_featured?: boolean;
          rejection_reason?: string | null;
          moderation_notes?: string | null;
          created_at?: string;
        };
        Update: {
          service_requested?: string;
          scope_notes?: string;
          estimated_budget_usd?: number;
          status?: QuoteRequestRecord['status'];
          approved?: boolean;
          is_featured?: boolean;
          rejection_reason?: string | null;
          moderation_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Relationships: [];
      };
      quote_requests: {
        Row: TableRow<QuoteRequestRecord>;
        Insert: {
          id?: string;
          user_id?: string;
          provider_id: string;
          provider_name: string;
          service_requested: string;
          estimated_budget_usd: number;
          currency_code?: SupportedCurrency;
          scope_notes: string;
          status?: QuoteRequestRecord['status'];
          approved?: boolean;
          is_featured?: boolean;
          rejection_reason?: string | null;
          moderation_notes?: string | null;
          created_at?: string;
        };
        Update: {
          service_requested?: string;
          scope_notes?: string;
          estimated_budget_usd?: number;
          status?: QuoteRequestRecord['status'];
          approved?: boolean;
          is_featured?: boolean;
          rejection_reason?: string | null;
          moderation_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Relationships: [];
      };
      opportunities: {
        Row: TableRow<UserOpportunityRecord>;
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          organization: string;
          category: OpportunitySubmissionCategory;
          location: string;
          deadline: string;
          compensation_usd?: number;
          description: string;
          requirements?: string[];
          reference_code: string;
          status?: ContentStatus;
          approved?: boolean;
          is_featured?: boolean;
          rejection_reason?: string | null;
          moderation_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          organization?: string;
          category?: OpportunitySubmissionCategory;
          location?: string;
          deadline?: string;
          compensation_usd?: number;
          description?: string;
          requirements?: string[];
          status?: ContentStatus;
          approved?: boolean;
          is_featured?: boolean;
          rejection_reason?: string | null;
          moderation_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: TableRow<UserServiceRecord>;
        Insert: {
          id?: string;
          user_id?: string;
          service_name: string;
          provider_organization: string;
          expertise_area: ServiceExpertiseArea;
          regional_coverage?: string;
          rate_or_pricing_model: string;
          estimated_rate_usd?: number;
          scope_description: string;
          portfolio_links?: string;
          certifications?: string;
          reference_code: string;
          status?: ContentStatus;
          approved?: boolean;
          is_featured?: boolean;
          rejection_reason?: string | null;
          moderation_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          service_name?: string;
          provider_organization?: string;
          expertise_area?: ServiceExpertiseArea;
          regional_coverage?: string;
          rate_or_pricing_model?: string;
          estimated_rate_usd?: number;
          scope_description?: string;
          portfolio_links?: string;
          certifications?: string;
          status?: ContentStatus;
          approved?: boolean;
          is_featured?: boolean;
          rejection_reason?: string | null;
          moderation_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: TableRow<UserProfile>;
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          company_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          status?: UserStatus;
          verification_status?: UserVerificationStatus;
          verification_notes?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          preferred_currency?: SupportedCurrency;
          terms_accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          company_name?: string | null;
          phone?: string | null;
          role?: UserRole;
          status?: UserStatus;
          verification_status?: UserVerificationStatus;
          verification_notes?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          preferred_currency?: SupportedCurrency;
          terms_accepted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: TableRow<UserListedProject>;
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          mineral: string;
          region: string;
          licence_type: string;
          licence_reference: string;
          investment_usd: number;
          submitted_currency?: SupportedCurrency;
          summary: string;
          status?: UserListedProject['status'];
          approved?: boolean;
          is_featured?: boolean;
          rejection_reason?: string | null;
          moderation_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          summary?: string;
          investment_usd?: number;
          status?: UserListedProject['status'];
          approved?: boolean;
          is_featured?: boolean;
          rejection_reason?: string | null;
          moderation_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_subscriptions: {
        Row: TableRow<UserSubscriptionRecord>;
        Insert: TableRow<
          Omit<UserSubscriptionRecord, 'id' | 'created_at' | 'updated_at'> & {
            id?: string;
            created_at?: string;
            updated_at?: string;
          }
        >;
        Update: TableRow<
          Partial<Omit<UserSubscriptionRecord, 'id' | 'user_id' | 'created_at'>>
        >;
        Relationships: [];
      };
      payment_transactions: {
        Row: TableRow<PaymentTransactionRecord>;
        Insert: TableRow<
          Omit<PaymentTransactionRecord, 'id' | 'created_at' | 'updated_at'> & {
            id?: string;
            created_at?: string;
            updated_at?: string;
          }
        >;
        Update: TableRow<
          Partial<Omit<PaymentTransactionRecord, 'id' | 'user_id' | 'created_at'>>
        >;
        Relationships: [];
      };
      compliance_complaints: {
        Row: TableRow<ComplianceComplaintRecord>;
        Insert: {
          id?: string;
          reporter_user_id?: string | null;
          reporter_email: string;
          category: ComplianceComplaintCategory;
          reference_code?: string | null;
          description: string;
          status?: ComplianceComplaintStatus;
          resolution_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: ComplianceComplaintStatus;
          resolution_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_active_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      reconcile_clickpesa_payment: {
        Args: {
          p_clickpesa_order_id: string;
          p_signature_verified: boolean;
          p_new_state?: string;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
