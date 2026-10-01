"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchPapers, type Paper } from "@/lib/backend";

type PaperListProps = {
  // Load only once the backend is awake, so a cold start isn't hit twice.
  enabled: boolean;
};

export function PaperList({ enabled }: PaperListProps) {
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const controller = new AbortController();
    fetchPapers(controller.signal)
      .then(setPapers)
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : "Could not load papers.");
        }
      });
    return () => controller.abort();
  }, [enabled]);

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const sorted = [...(papers ?? [])].sort((a, b) => a.title.localeCompare(b.title));
    return needle ? sorted.filter((paper) => paper.title.toLowerCase().includes(needle)) : sorted;
  }, [papers, filter]);

  return (
    <section className="rounded-[8px] border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <span>
          <span className="block text-base font-semibold text-slate-950 dark:text-white">
            Indexed papers
          </span>
          <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-400">
            arXiv papers on RAG, LLMs, and retrieval. Questions outside them are declined.
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="rounded-[6px] bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/20">
            {papers ? papers.length : "…"}
          </span>
          <span className={`text-slate-400 transition ${open ? "rotate-180" : ""}`}>▾</span>
        </span>
      </button>

      {open ? (
        <div className="mt-4">
          {error ? (
            <p className="text-sm text-orange-700 dark:text-orange-300">{error}</p>
          ) : (
            <>
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter by title…"
                aria-label="Filter papers by title"
                className="w-full rounded-[8px] border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100"
              />
              <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto pr-1">
                {shown.map((paper) => (
                  <li key={paper.id}>
                    <a
                      href={paper.url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-[6px] px-2 py-1.5 text-sm leading-5 text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                    >
                      {paper.title}
                    </a>
                  </li>
                ))}
                {papers && shown.length === 0 ? (
                  <li className="px-2 py-1.5 text-sm text-slate-500">No matching titles.</li>
                ) : null}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
