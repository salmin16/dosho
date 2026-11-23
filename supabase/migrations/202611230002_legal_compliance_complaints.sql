-- ============================================================================
-- MineConnect Legal, Clickwrap Consent & Compliance Complaints Migration
-- ============================================================================

-- 1. Track explicit clickwrap Terms of Use & Privacy Policy acceptance timestamp
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- 2. Compliance & Listing Complaints Registry (`public.compliance_complaints`)
CREATE TABLE IF NOT EXISTS public.compliance_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_email text NOT NULL,
  category text NOT NULL CHECK (
    category IN (
      'Unverified License',
      'Misleading Claim',
      'Fee Circumvention',
      'Privacy',
      'Other'
    )
  ),
  reference_code text,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'investigating', 'resolved', 'dismissed')
  ),
  resolution_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_complaints_status_created
  ON public.compliance_complaints (status, created_at DESC);

ALTER TABLE public.compliance_complaints ENABLE ROW LEVEL SECURITY;

-- Grants: public & authenticated visitors may submit complaints; only admins may manage all rows
GRANT INSERT ON public.compliance_complaints TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.compliance_complaints TO authenticated;

DROP POLICY IF EXISTS "Anyone can submit a compliance complaint" ON public.compliance_complaints;
CREATE POLICY "Anyone can submit a compliance complaint"
  ON public.compliance_complaints
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(trim(reporter_email)) >= 5
    AND length(trim(description)) >= 10
  );

DROP POLICY IF EXISTS "Reporters can view their own complaints" ON public.compliance_complaints;
CREATE POLICY "Reporters can view their own complaints"
  ON public.compliance_complaints
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_user_id);

DROP POLICY IF EXISTS "Admins can manage all compliance complaints" ON public.compliance_complaints;
CREATE POLICY "Admins can manage all compliance complaints"
  ON public.compliance_complaints
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
