
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action_type: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_summary: string | null
          target_table: string
        }
        Insert: {
          action_type: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_summary?: string | null
          target_table: string
        }
        Update: {
          action_type?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_summary?: string | null
          target_table?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      compliance_complaints: {
        Row: {
          admin_notes: string | null
          category: string
          closed_at: string | null
          closed_by: string | null
          created_at: string
          description: string
          id: string
          reference_code: string | null
          reporter_email: string
          reporter_id: string | null
          reporter_user_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_reference: string | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          category: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          description: string
          id?: string
          reference_code?: string | null
          reporter_email: string
          reporter_id?: string | null
          reporter_user_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          category?: string
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          description?: string
          id?: string
          reference_code?: string | null
          reporter_email?: string
          reporter_id?: string | null
          reporter_user_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_reference?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      market_sync_logs: {
        Row: {
          commodities_synced: number
          created_at: string
          error_message: string | null
          id: string
          latency_ms: number
          provider: string
          status: string
          sync_mode: string
        }
        Insert: {
          commodities_synced?: number
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number
          provider: string
          status: string
          sync_mode: string
        }
        Update: {
          commodities_synced?: number
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number
          provider?: string
          status?: string
          sync_mode?: string
        }
        Relationships: []
      }
      mineral_prices: {
        Row: {
          buying_centre_price_usd: number
          category: string
          change_24h_usd: number | null
          day_high_usd: number | null
          day_low_usd: number | null
          day_open_usd: number | null
          exchange_desk: string | null
          feed_source: string | null
          id: string
          inspection_fee_pct: number
          last_synced_at: string | null
          local_market_price_usd: number
          local_statutory_unit: string
          mineral_name: string
          producing_regions: string
          purity_note: string
          royalty_rate_pct: number
          sparkline_points: Json
          symbol: string
          trend_percentage: number
          unit: string
          updated_at: string
          world_market_price_usd: number
        }
        Insert: {
          buying_centre_price_usd: number
          category?: string
          change_24h_usd?: number | null
          day_high_usd?: number | null
          day_low_usd?: number | null
          day_open_usd?: number | null
          exchange_desk?: string | null
          feed_source?: string | null
          id?: string
          inspection_fee_pct?: number
          last_synced_at?: string | null
          local_market_price_usd: number
          local_statutory_unit?: string
          mineral_name: string
          producing_regions?: string
          purity_note?: string
          royalty_rate_pct?: number
          sparkline_points?: Json
          symbol: string
          trend_percentage?: number
          unit?: string
          updated_at?: string
          world_market_price_usd: number
        }
        Update: {
          buying_centre_price_usd?: number
          category?: string
          change_24h_usd?: number | null
          day_high_usd?: number | null
          day_low_usd?: number | null
          day_open_usd?: number | null
          exchange_desk?: string | null
          feed_source?: string | null
          id?: string
          inspection_fee_pct?: number
          last_synced_at?: string | null
          local_market_price_usd?: number
          local_statutory_unit?: string
          mineral_name?: string
          producing_regions?: string
          purity_note?: string
          royalty_rate_pct?: number
          sparkline_points?: Json
          symbol?: string
          trend_percentage?: number
          unit?: string
          updated_at?: string
          world_market_price_usd?: number
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          approved: boolean
          category: string
          compensation_usd: number
          created_at: string
          deadline: string
          description: string
          id: string
          is_featured: boolean
          location: string
          moderation_notes: string | null
          organization: string
          reference_code: string
          rejection_reason: string | null
          requirements: string[]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          category: string
          compensation_usd?: number
          created_at?: string
          deadline: string
          description: string
          id?: string
          is_featured?: boolean
          location: string
          moderation_notes?: string | null
          organization: string
          reference_code: string
          rejection_reason?: string | null
          requirements?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          category?: string
          compensation_usd?: number
          created_at?: string
          deadline?: string
          description?: string
          id?: string
          is_featured?: boolean
          location?: string
          moderation_notes?: string | null
          organization?: string
          reference_code?: string
          rejection_reason?: string | null
          requirements?: string[]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          account_or_phone_masked: string | null
          amount_tzs: number | null
          azampay_transaction_id: string | null
          billing_cycle: string | null
          charged_amount: number | null
          charged_currency: string
          clickpesa_control_number: string | null
          clickpesa_order_id: string | null
          created_at: string
          external_id: string | null
          gateway: string
          id: string
          idempotency_key: string | null
          metadata: Json
          payment_method_label: string | null
          phone_number: string | null
          provider: string | null
          provider_code: string | null
          rail: string | null
          raw_callback: Json | null
          reconciled_at: string | null
          state: string
          status: string
          tier: string | null
          tier_name: string | null
          updated_at: string
          user_id: string
          verified_amount_tzs: number | null
          verified_amount_usd: number | null
          webhook_signature_verified: boolean
        }
        Insert: {
          account_or_phone_masked?: string | null
          amount_tzs?: number | null
          azampay_transaction_id?: string | null
          billing_cycle?: string | null
          charged_amount?: number | null
          charged_currency?: string
          clickpesa_control_number?: string | null
          clickpesa_order_id?: string | null
          created_at?: string
          external_id?: string | null
          gateway?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          payment_method_label?: string | null
          phone_number?: string | null
          provider?: string | null
          provider_code?: string | null
          rail?: string | null
          raw_callback?: Json | null
          reconciled_at?: string | null
          state?: string
          status?: string
          tier?: string | null
          tier_name?: string | null
          updated_at?: string
          user_id: string
          verified_amount_tzs?: number | null
          verified_amount_usd?: number | null
          webhook_signature_verified?: boolean
        }
        Update: {
          account_or_phone_masked?: string | null
          amount_tzs?: number | null
          azampay_transaction_id?: string | null
          billing_cycle?: string | null
          charged_amount?: number | null
          charged_currency?: string
          clickpesa_control_number?: string | null
          clickpesa_order_id?: string | null
          created_at?: string
          external_id?: string | null
          gateway?: string
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          payment_method_label?: string | null
          phone_number?: string | null
          provider?: string | null
          provider_code?: string | null
          rail?: string | null
          raw_callback?: Json | null
          reconciled_at?: string | null
          state?: string
          status?: string
          tier?: string | null
          tier_name?: string | null
          updated_at?: string
          user_id?: string
          verified_amount_tzs?: number | null
          verified_amount_usd?: number | null
          webhook_signature_verified?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          preferred_currency: string | null
          role: string | null
          status: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string | null
          verification_level: string
          verification_notes: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_currency?: string | null
          role?: string | null
          status?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string | null
          verification_level?: string
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_currency?: string | null
          role?: string | null
          status?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string | null
          verification_level?: string
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          investment_usd: number
          is_featured: boolean
          licence_reference: string
          licence_type: string
          mineral: string
          moderation_notes: string | null
          region: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_currency: string
          summary: string
          title: string
          updated_at: string
          user_id: string
          verification_level: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          investment_usd?: number
          is_featured?: boolean
          licence_reference: string
          licence_type: string
          mineral: string
          moderation_notes?: string | null
          region: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_currency?: string
          summary: string
          title: string
          updated_at?: string
          user_id?: string
          verification_level?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          investment_usd?: number
          is_featured?: boolean
          licence_reference?: string
          licence_type?: string
          mineral?: string
          moderation_notes?: string | null
          region?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_currency?: string
          summary?: string
          title?: string
          updated_at?: string
          user_id?: string
          verification_level?: string
        }
        Relationships: []
      }
      quote_requests: {
        Row: {
          approved: boolean
          created_at: string
          currency_code: string
          estimated_budget_usd: number
          id: string
          moderation_notes: string | null
          provider_id: string
          provider_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          scope_notes: string
          service_requested: string
          status: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          currency_code?: string
          estimated_budget_usd?: number
          id?: string
          moderation_notes?: string | null
          provider_id: string
          provider_name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope_notes: string
          service_requested: string
          status?: string
          user_id?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          currency_code?: string
          estimated_budget_usd?: number
          id?: string
          moderation_notes?: string | null
          provider_id?: string
          provider_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope_notes?: string
          service_requested?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          approved: boolean
          created_at: string
          currency_code: string
          estimated_budget_usd: number
          id: string
          is_featured: boolean
          moderation_notes: string | null
          provider_id: string
          provider_name: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scope_notes: string
          service_requested: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          currency_code?: string
          estimated_budget_usd?: number
          id?: string
          is_featured?: boolean
          moderation_notes?: string | null
          provider_id: string
          provider_name: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope_notes: string
          service_requested: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          currency_code?: string
          estimated_budget_usd?: number
          id?: string
          is_featured?: boolean
          moderation_notes?: string | null
          provider_id?: string
          provider_name?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope_notes?: string
          service_requested?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          approved: boolean
          certifications: string
          created_at: string
          estimated_rate_usd: number
          expertise_area: string
          id: string
          is_featured: boolean
          moderation_notes: string | null
          portfolio_links: string
          provider_organization: string
          rate_or_pricing_model: string
          reference_code: string
          regional_coverage: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scope_description: string
          service_name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          certifications?: string
          created_at?: string
          estimated_rate_usd?: number
          expertise_area: string
          id?: string
          is_featured?: boolean
          moderation_notes?: string | null
          portfolio_links?: string
          provider_organization: string
          rate_or_pricing_model: string
          reference_code: string
          regional_coverage?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope_description: string
          service_name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean
          certifications?: string
          created_at?: string
          estimated_rate_usd?: number
          expertise_area?: string
          id?: string
          is_featured?: boolean
          moderation_notes?: string | null
          portfolio_links?: string
          provider_organization?: string
          rate_or_pricing_model?: string
          reference_code?: string
          regional_coverage?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope_description?: string
          service_name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          payment_method: string
          plan_id: string
          receipt_url: string | null
          reference_code: string
          status: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          payment_method: string
          plan_id: string
          receipt_url?: string | null
          reference_code: string
          status?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          payment_method?: string
          plan_id?: string
          receipt_url?: string | null
          reference_code?: string
          status?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_cycle: string
          can_access_data_room: boolean
          can_export_markets: boolean
          id: string
          is_active: boolean
          max_active_listings: number
          max_monthly_rfqs: number
          name: string
          price_tzs: number
          price_usd: number
          sort_order: number
          tagline: string
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          can_access_data_room?: boolean
          can_export_markets?: boolean
          id: string
          is_active?: boolean
          max_active_listings?: number
          max_monthly_rfqs?: number
          name: string
          price_tzs?: number
          price_usd?: number
          sort_order?: number
          tagline: string
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          can_access_data_room?: boolean
          can_export_markets?: boolean
          id?: string
          is_active?: boolean
          max_active_listings?: number
          max_monthly_rfqs?: number
          name?: string
          price_tzs?: number
          price_usd?: number
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_documents: {
        Row: {
          approved: boolean
          classification: string
          content: string
          created_at: string
          id: string
          moderation_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          classification?: string
          content: string
          created_at?: string
          id?: string
          moderation_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          approved?: boolean
          classification?: string
          content?: string
          created_at?: string
          id?: string
          moderation_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_localization_preferences: {
        Row: {
          preferred_currency: string
          preferred_language: string
          unit_basis: string
          updated_at: string
          user_id: string
        }
        Insert: {
          preferred_currency?: string
          preferred_language?: string
          unit_basis?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          preferred_currency?: string
          preferred_language?: string
          unit_basis?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          company_name: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_currency: string
          role: string
          status: string
          updated_at: string
          verification_notes: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_currency?: string
          role?: string
          status?: string
          updated_at?: string
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_currency?: string
          role?: string
          status?: string
          updated_at?: string
          verification_notes?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      user_projects: {
        Row: {
          approved: boolean
          created_at: string
          id: string
          investment_usd: number
          licence_reference: string
          licence_type: string
          mineral: string
          moderation_notes: string | null
          region: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_currency: string
          summary: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          id?: string
          investment_usd: number
          licence_reference: string
          licence_type: string
          mineral: string
          moderation_notes?: string | null
          region: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_currency?: string
          summary: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          id?: string
          investment_usd?: number
          licence_reference?: string
          licence_type?: string
          mineral?: string
          moderation_notes?: string | null
          region?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_currency?: string
          summary?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          billing_cycle: string
          created_at: string
          expires_at: string
          id: string
          payment_gateway: string
          payment_method: string | null
          payment_provider: string | null
          payment_rail: string
          payment_reference: string | null
          plan_id: string
          price_tzs: number
          price_usd: number
          starts_at: string
          status: string
          tier_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle?: string
          created_at?: string
          expires_at?: string
          id?: string
          payment_gateway?: string
          payment_method?: string | null
          payment_provider?: string | null
          payment_rail?: string
          payment_reference?: string | null
          plan_id?: string
          price_tzs?: number
          price_usd?: number
          starts_at?: string
          status?: string
          tier_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          expires_at?: string
          id?: string
          payment_gateway?: string
          payment_method?: string | null
          payment_provider?: string | null
          payment_rail?: string
          payment_reference?: string | null
          plan_id?: string
          price_tzs?: number
          price_usd?: number
          starts_at?: string
          status?: string
          tier_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          preferred_currency: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          preferred_currency?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          preferred_currency?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      verification_submissions: {
        Row: {
          company_name: string
          created_at: string
          document_mime: string | null
          document_name: string | null
          document_size_bytes: number | null
          document_storage_path: string | null
          id: string
          licence_reference: string | null
          notes: string | null
          phone: string | null
          requested_level: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name: string
          created_at?: string
          document_mime?: string | null
          document_name?: string | null
          document_size_bytes?: number | null
          document_storage_path?: string | null
          id?: string
          licence_reference?: string | null
          notes?: string | null
          phone?: string | null
          requested_level?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string
          created_at?: string
          document_mime?: string | null
          document_name?: string | null
          document_size_bytes?: number | null
          document_storage_path?: string | null
          id?: string
          licence_reference?: string | null
          notes?: string | null
          phone?: string | null
          requested_level?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_review_subscription_payment: {
        Args: { p_decision: string; p_notes?: string; p_payment_id: string }
        Returns: Json
      }
      can_create_listing: { Args: { uid: string }; Returns: boolean }
      can_submit_rfq: { Args: { uid: string }; Returns: boolean }
      get_accounts_billing_ledger: {
        Args: never
        Returns: {
          account_state: string
          email: string
          expires_at: string
          full_name: string
          payment_method: string
          payment_reference: string
          plan_id: string
          plan_name: string
          starts_at: string
          total_payments: number
          user_id: string
        }[]
      }
      get_user_entitlements: { Args: { uid: string }; Returns: Json }
      is_active_admin: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_billing_admin: { Args: never; Returns: boolean }
      reconcile_clickpesa_payment: {
        Args: {
          p_clickpesa_order_id: string
          p_new_state?: string
          p_signature_verified: boolean
        }
        Returns: Json
      }
      upsert_live_mineral_spot: {
        Args: {
          p_feed_source?: string
          p_symbol: string
          p_trend_pct: number
          p_world_spot_usd: number
        }
        Returns: {
          buying_centre_price_usd: number
          category: string
          change_24h_usd: number | null
          day_high_usd: number | null
          day_low_usd: number | null
          day_open_usd: number | null
          exchange_desk: string | null
          feed_source: string | null
          id: string
          inspection_fee_pct: number
          last_synced_at: string | null
          local_market_price_usd: number
          local_statutory_unit: string
          mineral_name: string
          producing_regions: string
          purity_note: string
          royalty_rate_pct: number
          sparkline_points: Json
          symbol: string
          trend_percentage: number
          unit: string
          updated_at: string
          world_market_price_usd: number
        }
        SetofOptions: {
          from: "*"
          to: "mineral_prices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
