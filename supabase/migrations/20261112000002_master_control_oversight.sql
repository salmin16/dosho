-- ============================================================================
-- MIGRATION: Master Control & Oversight Module
-- Complete Content Explorer, Moderation & Pending Approval Queue, and User Analytics
-- ============================================================================

-- 1. Extend user_documents with moderation & status governance fields
ALTER TABLE public.user_documents
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (
        status IN ('pending', 'active', 'archived', 'flagged', 'rejected')
    ),
    ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_documents_status ON public.user_documents(status, approved);

-- 2. Extend user_projects with moderation approval tracking
ALTER TABLE public.user_projects
    ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Allow extended moderation statuses on user_projects
ALTER TABLE public.user_projects DROP CONSTRAINT IF EXISTS user_projects_status_check;
ALTER TABLE public.user_projects
    ADD CONSTRAINT user_projects_status_check CHECK (
        status IN ('PENDING_VERIFICATION', 'VERIFIED', 'ARCHIVED', 'FLAGGED', 'REJECTED')
    );

CREATE INDEX IF NOT EXISTS idx_user_projects_moderation ON public.user_projects(status, approved);

-- 3. Extend quote_requests with moderation approval tracking
ALTER TABLE public.quote_requests
    ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.quote_requests DROP CONSTRAINT IF EXISTS quote_requests_status_check;
ALTER TABLE public.quote_requests
    ADD CONSTRAINT quote_requests_status_check CHECK (
        status IN ('SUBMITTED', 'QUOTED', 'CLOSED', 'FLAGGED', 'REJECTED')
    );

CREATE INDEX IF NOT EXISTS idx_quote_requests_moderation ON public.quote_requests(status, approved);

-- 4. Admin Oversight Row-Level Security (RLS) Policies
-- Grant admins (`public.is_admin()`) full SELECT, UPDATE, and DELETE oversight across all content tables

DROP POLICY IF EXISTS "Admins can view all documents" ON public.user_documents;
CREATE POLICY "Admins can view all documents"
    ON public.user_documents
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update any document" ON public.user_documents;
CREATE POLICY "Admins can update any document"
    ON public.user_documents
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any document" ON public.user_documents;
CREATE POLICY "Admins can delete any document"
    ON public.user_documents
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any listed project" ON public.user_projects;
CREATE POLICY "Admins can delete any listed project"
    ON public.user_projects
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update any quote request" ON public.quote_requests;
CREATE POLICY "Admins can update any quote request"
    ON public.quote_requests
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any quote request" ON public.quote_requests;
CREATE POLICY "Admins can delete any quote request"
    ON public.quote_requests
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());
