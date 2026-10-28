-- ============================================================================
-- 1. EXTENSIONS & TABLES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Profiles Table (1-to-1 with auth.users, includes preferred_currency)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    preferred_currency TEXT NOT NULL DEFAULT 'USD' CHECK (
        preferred_currency IN ('USD', 'EUR', 'GBP', 'TZS', 'JPY', 'ZAR', 'AUD', 'CAD', 'CNY', 'AED')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Documents Table (1-to-Many with auth.users for strict data grounding)
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

-- Gated User Projects Table ("List a Project" workflow — strictly requires auth.uid())
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

-- Gated Quote Requests Table ("Request a Quote" workflow — strictly requires auth.uid())
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

-- Indexes for performance on RLS lookups and ordering
CREATE INDEX IF NOT EXISTS idx_user_documents_user_id ON public.user_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_documents_created_at ON public.user_documents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON public.user_projects(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_requests_user_id ON public.quote_requests(user_id, created_at DESC);

-- ============================================================================
-- 2. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_documents FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_projects FORCE ROW LEVEL SECURITY;

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_requests FORCE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY "Users can view strictly their own profile"
    ON public.user_profiles FOR SELECT TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can insert strictly their own profile"
    ON public.user_profiles FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update strictly their own profile"
    ON public.user_profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policies for user_documents
CREATE POLICY "Users can view strictly their own documents"
    ON public.user_documents FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert strictly their own documents"
    ON public.user_documents FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update strictly their own documents"
    ON public.user_documents FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete strictly their own documents"
    ON public.user_documents FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- Policies for user_projects (Mandatory Membership for "List a Project")
CREATE POLICY "Users can view strictly their own listed projects"
    ON public.user_projects FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Authenticated members can list strictly their own projects"
    ON public.user_projects FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update strictly their own listed projects"
    ON public.user_projects FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policies for quote_requests (Mandatory Membership for "Request a Quote")
CREATE POLICY "Users can view strictly their own quote requests"
    ON public.quote_requests FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Authenticated members can submit strictly their own quote requests"
    ON public.quote_requests FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 3. AUTOMATED TRIGGERS (PROFILE PROVISIONING & TIMESTAMPS)
-- ============================================================================
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

CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_user_documents_updated_at
    BEFORE UPDATE ON public.user_documents
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_user_projects_updated_at
    BEFORE UPDATE ON public.user_projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Automatically provision a user_profile row upon Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, preferred_currency)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'preferred_currency', 'USD')
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
