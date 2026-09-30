"use client";

import { useEffect, useState } from "react";

type UsageSummary = {
  totalRequests: number;
  byRoute: { chat: number; upload: number };
  averageLatencyMs: number;
};

export function UsagePanel() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const response = await fetch("/api/usage");
        const data = (await response.json()) as UsageSummary & { error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load usage statistics.");
        }

        if (!cancelled) {
          setSummary(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load usage statistics.",
          );
        }
      }
    }

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return null;
  }

  return (
    <section className="rounded-[8px] border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/60 dark:shadow-black/20">
      <h2 className="text-base font-semibold text-slate-950 dark:text-white">Usage</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
        Recent activity across this workspace.
      </p>

      {summary ? (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-[8px] bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              Questions
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {summary.byRoute.chat}
            </p>
          </div>
          <div className="rounded-[8px] bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              Uploads
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {summary.byRoute.upload}
            </p>
          </div>
          <div className="rounded-[8px] bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              Avg latency
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {summary.averageLatencyMs} ms
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 h-16 animate-pulse rounded-[8px] bg-slate-100 dark:bg-slate-800" />
      )}
    </section>
  );
}
