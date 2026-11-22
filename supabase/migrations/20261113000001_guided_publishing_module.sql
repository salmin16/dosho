-- =============================================================================
-- Migration: 20261113_guided_publishing_module.sql
-- Purpose:   Multi-Form Submission & Guided Publishing Module (`opportunities` & `services`)
--            with strict Row Level Security (`auth.uid() = user_id` + `public.is_admin()`)
--            and Admin Approval Queue integration (`status = 'pending'`).
-- =============================================================================

-- 1. Create `public.opportunities` Table
CREATE TABLE IF NOT EXISTS public.opportunities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL CHECK (char_length(title) BETWEEN 5 AND 200),
  organization      TEXT NOT NULL CHECK (char_length(organization) BETWEEN 2 AND 160),
  category          TEXT NOT NULL CHECK (category IN (
                      'Tender',
                      'Consultancy',
                      'Grant',
                      'Internship',
                      'Joint Venture',
                      'Equipment Supply'
                    )),
  location          TEXT NOT NULL,
  deadline          DATE NOT NULL,
  compensation_usd  NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (compensation_usd >= 0),
  description       TEXT NOT NULL CHECK (char_length(description) BETWEEN 20 AND 8000),
  requirements      TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  reference_code    TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                      'pending',
                      'active',
                      'archived',
                      'flagged',
                      'rejected'
                    )),
  approved          BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_notes  TEXT,
  reviewed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_user_id ON public.opportunities(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_category ON public.opportunities(category);

-- 2. Create `public.services` Table
CREATE TABLE IF NOT EXISTS public.services (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name            TEXT NOT NULL CHECK (char_length(service_name) BETWEEN 5 AND 200),
  provider_organization   TEXT NOT NULL CHECK (char_length(provider_organization) BETWEEN 2 AND 160),
  expertise_area          TEXT NOT NULL CHECK (expertise_area IN (
                            'Geological & Exploration',
                            'Drilling & Core Recovery',
                            'Assay & Laboratory Testing',
                            'Legal, Licensing & Cadastre',
                            'Environmental (ESIA) & ESG',
                            'Mine Engineering & EPCM'
                          )),
  regional_coverage       TEXT NOT NULL DEFAULT 'All Tanzania (31 Mikoa)',
  rate_or_pricing_model   TEXT NOT NULL,
  estimated_rate_usd      NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (estimated_rate_usd >= 0),
  scope_description       TEXT NOT NULL CHECK (char_length(scope_description) BETWEEN 20 AND 8000),
  portfolio_links         TEXT NOT NULL DEFAULT '',
  certifications          TEXT NOT NULL DEFAULT '',
  reference_code          TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending',
                            'active',
                            'archived',
                            'flagged',
                            'rejected'
                          )),
  approved                BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_notes        TEXT,
  reviewed_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_user_id ON public.services(user_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON public.services(status);
CREATE INDEX IF NOT EXISTS idx_services_expertise ON public.services(expertise_area);

-- 3. Enable & Force Row Level Security (RLS)
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities FORCE ROW LEVEL SECURITY;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services FORCE ROW LEVEL SECURITY;

-- 4. RLS Policies for `public.opportunities`
DROP POLICY IF EXISTS "Users can insert own opportunities" ON public.opportunities;
CREATE POLICY "Users can insert own opportunities"
  ON public.opportunities
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own or published opportunities" ON public.opportunities;
CREATE POLICY "Users can read own or published opportunities"
  ON public.opportunities
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active' OR auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own pending opportunities or admins override" ON public.opportunities;
CREATE POLICY "Users can update own pending opportunities or admins override"
  ON public.opportunities
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id AND status = 'pending') OR public.is_admin())
  WITH CHECK ((auth.uid() = user_id AND status = 'pending') OR public.is_admin());

DROP POLICY IF EXISTS "Admins can delete opportunities" ON public.opportunities;
CREATE POLICY "Admins can delete opportunities"
  ON public.opportunities
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- 5. RLS Policies for `public.services`
DROP POLICY IF EXISTS "Users can insert own services" ON public.services;
CREATE POLICY "Users can insert own services"
  ON public.services
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own or published services" ON public.services;
CREATE POLICY "Users can read own or published services"
  ON public.services
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active' OR auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own pending services or admins override" ON public.services;
CREATE POLICY "Users can update own pending services or admins override"
  ON public.services
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id AND status = 'pending') OR public.is_admin())
  WITH CHECK ((auth.uid() = user_id AND status = 'pending') OR public.is_admin());

DROP POLICY IF EXISTS "Admins can delete services" ON public.services;
CREATE POLICY "Admins can delete services"
  ON public.services
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());
