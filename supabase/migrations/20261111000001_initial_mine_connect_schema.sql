-- ============================================================================
-- Migration: 20261111000001_initial_mine_connect_schema.sql
-- Purpose:   Base Mine Connect PostgreSQL Schema (Profiles, Vault, Projects,
--            Quote Requests, Audit Logs, Triggers & Mandatory RLS)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. User Profiles Table (1-to-1 with auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    preferred_currency TEXT NOT NULL DEFAULT 'USD' CHECK (
        preferred_currency IN ('USD', 'EUR', 'GBP', 'TZS', 'JPY', 'ZAR', 'AUD', 'CAD', 'CNY', 'AED')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);

-- 2. Audit Logs Table (Immutable Security Trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- 3. User Documents Table (Grounded Technical Dossiers, JORC & Assay Vault)
CREATE TABLE IF NOT EXISTS public.user_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 200),
    content TEXT NOT NULL CHECK (char_length(content) <= 10000),
    classification TEXT NOT NULL DEFAULT 'CONFIDENTIAL' CHECK (
        classification IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. User Projects Table ("List a Project" workflow)
CREATE TABLE IF NOT EXISTS public.user_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 200),
    mineral TEXT NOT NULL,
    region TEXT NOT NULL,
    licence_type TEXT NOT NULL,
    licence_reference TEXT NOT NULL,
    investment_usd NUMERIC(15, 2) NOT NULL CHECK (investment_usd >= 0),
    submitted_currency TEXT NOT NULL DEFAULT 'USD',
    summary TEXT NOT NULL CHECK (char_length(summary) <= 10000),
    status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK (
        status IN ('PENDING_VERIFICATION', 'VERIFIED', 'ARCHIVED')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Quote Requests Table ("Request a Quote" workflow)
CREATE TABLE IF NOT EXISTS public.quote_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    service_requested TEXT NOT NULL,
    estimated_budget_usd NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (estimated_budget_usd >= 0),
    currency_code TEXT NOT NULL DEFAULT 'USD',
    scope_notes TEXT NOT NULL CHECK (char_length(scope_notes) <= 5000),
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (
        status IN ('SUBMITTED', 'QUOTED', 'CLOSED')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON public.user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_created_at ON public.user_documents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON public.user_projects(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_requests_user_id ON public.quote_requests(user_id, created_at DESC);

-- 6. Helper Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE id = (SELECT auth.uid())
          AND role = 'admin'
          AND status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 7. Enable & Force Mandatory Row-Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_documents FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_projects FORCE ROW LEVEL SECURITY;

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests FORCE ROW LEVEL SECURITY;

-- Base Policies (Idempotent)
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON public.user_profiles;
CREATE POLICY "Users can view own profile or admins can view all"
    ON public.user_profiles FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Users can insert strictly their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert strictly their own profile"
    ON public.user_profiles FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = id AND role = 'user');

DROP POLICY IF EXISTS "Users can update own profile or admins can update any" ON public.user_profiles;
CREATE POLICY "Users can update own profile or admins can update any"
    ON public.user_profiles FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = id OR (SELECT public.is_admin()))
    WITH CHECK ((SELECT auth.uid()) = id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins can delete user profiles" ON public.user_profiles;
CREATE POLICY "Admins can delete user profiles"
    ON public.user_profiles FOR DELETE TO authenticated
    USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view all audit logs"
    ON public.audit_logs FOR SELECT TO authenticated
    USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
    ON public.audit_logs FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Users can view strictly their own documents" ON public.user_documents;
CREATE POLICY "Users can view strictly their own documents"
    ON public.user_documents FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert strictly their own documents" ON public.user_documents;
CREATE POLICY "Users can insert strictly their own documents"
    ON public.user_documents FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update strictly their own documents" ON public.user_documents;
CREATE POLICY "Users can update strictly their own documents"
    ON public.user_documents FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete strictly their own documents" ON public.user_documents;
CREATE POLICY "Users can delete strictly their own documents"
    ON public.user_documents FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view strictly their own listed projects" ON public.user_projects;
CREATE POLICY "Users can view strictly their own listed projects"
    ON public.user_projects FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Authenticated members can list strictly their own projects" ON public.user_projects;
CREATE POLICY "Authenticated members can list strictly their own projects"
    ON public.user_projects FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update strictly their own listed projects" ON public.user_projects;
CREATE POLICY "Users can update strictly their own listed projects"
    ON public.user_projects FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()))
    WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Users can view strictly their own quote requests" ON public.quote_requests;
CREATE POLICY "Users can view strictly their own quote requests"
    ON public.quote_requests FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_admin()));

DROP POLICY IF EXISTS "Authenticated members can submit strictly their own quote requests" ON public.quote_requests;
CREATE POLICY "Authenticated members can submit strictly their own quote requests"
    ON public.quote_requests FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- 8. Triggers
DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_user_documents_updated_at ON public.user_documents;
CREATE TRIGGER trg_user_documents_updated_at
    BEFORE UPDATE ON public.user_documents
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_user_projects_updated_at ON public.user_projects;
CREATE TRIGGER trg_user_projects_updated_at
    BEFORE UPDATE ON public.user_projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Strictly provision new public sign-ups with role = 'user' (never trust client role payloads)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, role, status, preferred_currency)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        'user',
        'active',
        CASE
            WHEN (NEW.raw_user_meta_data->>'preferred_currency') IN ('USD','EUR','GBP','TZS','JPY','ZAR','AUD','CAD','CNY','AED')
            THEN NEW.raw_user_meta_data->>'preferred_currency'
            ELSE 'USD'
        END
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
