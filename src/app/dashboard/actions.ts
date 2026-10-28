'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import type { DocumentClassification } from '@/types/database';

const ALLOWED_CLASSIFICATIONS: DocumentClassification[] = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
];

export async function createDocumentAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Unauthorized: Please sign in first.' };
  }

  const title = (formData.get('title') as string | null)?.trim() ?? '';
  const content = (formData.get('content') as string | null)?.trim() ?? '';
  const rawClassification =
    (formData.get('classification') as DocumentClassification | null) ??
    'CONFIDENTIAL';

  if (!title || title.length > 200) {
    return { error: 'Title is required and must be under 200 characters.' };
  }

  if (!content || content.length > 10000) {
    return { error: 'Content is required and must be under 10,000 characters.' };
  }

  const classification: DocumentClassification =
    ALLOWED_CLASSIFICATIONS.includes(rawClassification)
      ? rawClassification
      : 'CONFIDENTIAL';

  // Insert grounded to the authenticated user's UUID (`user.id`).
  // Even if tampered with, PostgreSQL RLS WITH CHECK (auth.uid() = user_id) enforces ownership.
  const { error } = await supabase.from('user_documents').insert({
    user_id: user.id,
    title,
    content,
    classification,
  });

  if (error) {
    return { error: 'Failed to create document. Please try again.' };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteDocumentAction(documentId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Unauthorized' };
  }

  // Defense-in-depth: Explicit `.eq('user_id', user.id)` combined with RLS policy
  const { error } = await supabase
    .from('user_documents')
    .delete()
    .eq('id', documentId)
    .eq('user_id', user.id);

  if (error) {
    return { error: 'Could not delete document.' };
  }

  revalidatePath('/dashboard');
  return { success: true };
}
