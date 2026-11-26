-- ============================================================================
-- Migration: 20261126000002_verification_multi_documents_10mb.sql
-- Purpose:   1. Add structured multi-document JSONB metadata column (`documents`)
--               to `public.verification_submissions` so L1–L4 submissions store
--               per-slot labeled files (`slotKey`, `label`, `fileName`, `size`, `path`).
--            2. Raise `verification-documents` private storage bucket limit to
--               strictly < 10 MB (10,485,760 bytes) per uploaded document.
-- ============================================================================

ALTER TABLE public.verification_submissions
  ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.verification_submissions.documents IS
  'Structured array of uploaded L1-L4 checklist documents: [{slotKey, label, required, fileName, mimeType, size, path}]';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-documents',
  'verification-documents',
  FALSE,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = FALSE,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
