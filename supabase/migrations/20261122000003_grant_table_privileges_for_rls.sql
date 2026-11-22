-- ============================================================================
-- Migration: 20261122000003_grant_table_privileges_for_rls.sql
-- Purpose:   Restore required PostgreSQL schema & table GRANTs for PostgREST
--            roles (`anon`, `authenticated`, `service_role`) so RLS policies
--            control row access instead of failing with 42501 table permission denied.
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Public-readable (RLS-filtered) + authenticated CRUD tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, service_role;
GRANT SELECT ON public.projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated, service_role;

-- Legacy & domain tables (strictly protected by RLS)
GRANT SELECT, UPDATE, DELETE ON public.user_profiles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_documents TO authenticated, service_role;
GRANT SELECT ON public.user_projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_projects TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_requests TO authenticated, service_role;
GRANT SELECT ON public.opportunities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated, service_role;
GRANT SELECT ON public.services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated, service_role;
GRANT SELECT ON public.mineral_prices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mineral_prices TO authenticated, service_role;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated, service_role;
GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;

-- Ensure admin helper functions are callable by authenticated & service_role
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated, service_role;
