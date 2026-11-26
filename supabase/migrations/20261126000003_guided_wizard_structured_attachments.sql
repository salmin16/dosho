-- ============================================================================
-- Migration: 20261126000003_guided_wizard_structured_attachments.sql
-- Purpose:   Add structured metadata (`structured_details` JSONB) and labeled
--            `< 10 MB` attachments (`attachments` JSONB) to `public.opportunities`
--            and `public.services` so Admin Moderation can inspect every uploaded
--            document and commercial/technical field cleanly.
-- ============================================================================

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS structured_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.opportunities.structured_details IS
  'Structured wizard metadata: commodity, district, coordinates, mineralRightType, licenceRef, licenceStatus, dealStructure, valueCurrency, etc.';
COMMENT ON COLUMN public.opportunities.attachments IS
  'Structured <10MB attachment metadata: [{slotKey, label, required, fileName, mimeType, size, path}]';

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS structured_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.services.structured_details IS
  'Structured wizard metadata: disciplineLabel, coverageRegions, equipmentStandards, pricingModel, rateCurrency, leadTime, accreditations, etc.';
COMMENT ON COLUMN public.services.attachments IS
  'Structured <10MB attachment metadata: [{slotKey, label, required, fileName, mimeType, size, path}]';
