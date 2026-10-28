'use client';

import React, { useRef, useState, useTransition } from 'react';
import {
  createDocumentAction,
  deleteDocumentAction,
} from '@/app/dashboard/actions';
import type { UserDocument } from '@/types/database';

interface DocumentManagerProps {
  initialDocuments: UserDocument[];
}

export default function DocumentManager({
  initialDocuments,
}: DocumentManagerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await createDocumentAction(formData);
      if (res?.error) {
        setError(res.error);
      } else {
        formRef.current?.reset();
      }
    });
  };

  const handleDelete = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await deleteDocumentAction(id);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Create Grounded Document Form */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">
          New Grounded Record
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Automatically bound to your <code className="text-indigo-400">auth.uid()</code> via PostgreSQL RLS.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <form ref={formRef} onSubmit={handleCreate} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-xs font-medium uppercase tracking-wider text-slate-400"
            >
              Document Title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={200}
              placeholder="e.g., Q4 Architecture Security Audit"
              className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="classification"
              className="block text-xs font-medium uppercase tracking-wider text-slate-400"
            >
              Security Classification
            </label>
            <select
              id="classification"
              name="classification"
              defaultValue="CONFIDENTIAL"
              className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="PUBLIC">PUBLIC</option>
              <option value="INTERNAL">INTERNAL</option>
              <option value="CONFIDENTIAL">CONFIDENTIAL</option>
              <option value="RESTRICTED">RESTRICTED</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="content"
              className="block text-xs font-medium uppercase tracking-wider text-slate-400"
            >
              Encrypted / Grounded Payload
            </label>
            <textarea
              id="content"
              name="content"
              rows={4}
              required
              maxLength={10000}
              placeholder="Enter sensitive user-grounded notes or context..."
              className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save to Personal Vault'}
          </button>
        </form>
      </section>

      {/* Grounded Documents List */}
      <section className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Your Grounded Documents ({initialDocuments.length})
          </h2>
          <span className="text-xs text-slate-400">
            Filtered by <code className="text-emerald-400">auth.uid() = user_id</code>
          </span>
        </div>

        {initialDocuments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
            <p className="text-sm text-slate-400">
              No grounded documents found for your user ID yet. Create your first record on the left.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {initialDocuments.map((doc) => (
              <article
                key={doc.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-slate-700"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
                        {doc.classification}
                      </span>
                      <h3 className="font-semibold text-white">{doc.title}</h3>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                      {doc.content}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span>Owner UUID: {doc.user_id}</span>
                      <span>
                        Created: {new Date(doc.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(doc.id)}
                    disabled={isPending}
                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
