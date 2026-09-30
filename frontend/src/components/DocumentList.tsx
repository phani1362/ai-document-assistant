"use client";

import { useEffect, useState } from "react";

export type DocumentSummary = {
  id: string;
  fileName: string;
  uploadedAt: string;
  chunkCount: number;
};

type DocumentListProps = {
  refreshKey: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDeleted: (id: string) => void;
};

export function DocumentList({
  refreshKey,
  selectedId,
  onSelect,
  onDeleted,
}: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/documents");
        const data = (await response.json()) as {
          documents?: DocumentSummary[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load documents.");
        }

        if (!cancelled) {
          setDocuments(data.documents ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load documents.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete document.");
      }

      setDocuments((current) => current.filter((doc) => doc.id !== id));
      onDeleted(id);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete document.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-[8px] border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/60 dark:shadow-black/20">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">Documents</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            Choose which document to query, or search across all of them.
          </p>
        </div>
        <span className="rounded-[6px] bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
          {documents.length} indexed
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-10 animate-pulse rounded-[8px] bg-slate-100 dark:bg-slate-800" />
          <div className="h-10 animate-pulse rounded-[8px] bg-slate-100 dark:bg-slate-800" />
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          No documents uploaded yet.
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`flex w-full items-center justify-between gap-3 rounded-[8px] border px-3 py-2.5 text-left text-sm font-semibold transition ${
              selectedId === null
                ? "border-blue-200 bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-200 hover:bg-blue-50/40"
            }`}
          >
            <span>All documents</span>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
              search everything
            </span>
          </button>

          {documents.map((doc) => (
            <div
              key={doc.id}
              className={`flex items-center justify-between gap-3 rounded-[8px] border px-3 py-2.5 transition ${
                selectedId === doc.id
                  ? "border-blue-200 bg-blue-50 ring-1 ring-blue-100"
                  : "border-slate-200 bg-white"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(doc.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {doc.fileName}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {doc.chunkCount} chunks · {new Date(doc.uploadedAt).toLocaleDateString()}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(doc.id)}
                disabled={deletingId === doc.id}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] text-slate-400 transition hover:bg-orange-50 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
                aria-label={`Delete ${doc.fileName}`}
              >
                {deletingId === doc.id ? (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-orange-300 border-t-orange-600 animate-spin" />
                ) : (
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7h10Z"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.6"
                    />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <p className="mt-4 rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
