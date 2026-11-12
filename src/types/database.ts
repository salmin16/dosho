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

export type DocumentClassification =
  | 'PUBLIC'
  | 'INTERNAL'
  | 'CONFIDENTIAL'
  | 'RESTRICTED';

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
  | 'ADMIN_UPDATE_ROLE'
  | 'ADMIN_SUSPEND_USER'
  | 'ADMIN_ACTIVATE_USER'
  | 'ADMIN_DELETE_USER'
  | 'UNAUTHORIZED_ADMIN_ATTEMPT'
  | (string & {});

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  status: UserStatus;
  preferred_currency?: SupportedCurrency;
  created_at: string;
  updated_at: string;
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
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'ARCHIVED';
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
  status: 'SUBMITTED' | 'QUOTED' | 'CLOSED';
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfile;
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          status?: UserStatus;
          preferred_currency?: SupportedCurrency;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          role?: UserRole;
          status?: UserStatus;
          preferred_currency?: SupportedCurrency;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: AuditLog;
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
      };
      user_documents: {
        Row: UserDocument;
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          content: string;
          classification?: DocumentClassification;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          content?: string;
          classification?: DocumentClassification;
          updated_at?: string;
        };
      };
      user_projects: {
        Row: UserListedProject;
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
          status?: 'PENDING_VERIFICATION' | 'VERIFIED' | 'ARCHIVED';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          summary?: string;
          investment_usd?: number;
          status?: 'PENDING_VERIFICATION' | 'VERIFIED' | 'ARCHIVED';
          updated_at?: string;
        };
      };
      quote_requests: {
        Row: QuoteRequestRecord;
        Insert: {
          id?: string;
          user_id?: string;
          provider_id: string;
          provider_name: string;
          service_requested: string;
          estimated_budget_usd: number;
          currency_code?: SupportedCurrency;
          scope_notes: string;
          status?: 'SUBMITTED' | 'QUOTED' | 'CLOSED';
          created_at?: string;
        };
        Update: {
          status?: 'SUBMITTED' | 'QUOTED' | 'CLOSED';
        };
      };
    };
  };
}
