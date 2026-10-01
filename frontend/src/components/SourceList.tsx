import type { Source } from "@/lib/backend";

type SourceListProps = {
  sources: Source[];
  activeSource: number | null;
  onSelect: (number: number | null) => void;
};

export function SourceList({ sources, activeSource, onSelect }: SourceListProps) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/60 dark:shadow-black/20">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">Sources</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            The paper sections the latest answer was checked against. Click a citation to jump
            to its source.
          </p>
        </div>
        <span className="rounded-[6px] bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/20">
          {sources.length}
        </span>
      </div>

      {sources.length === 0 ? (
        <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          Sources appear here after an answer.
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => {
            const active = activeSource === source.number;
            return (
              <article
                id={`source-${source.number}`}
                key={source.number}
                className={`scroll-mt-6 rounded-[8px] border p-4 transition ${
                  active
                    ? "border-blue-400 bg-blue-50/70 shadow-sm dark:border-blue-400/60 dark:bg-blue-500/10"
                    : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50"
                }`}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-3 text-left"
                  onClick={() => onSelect(active ? null : source.number)}
                  aria-expanded={active}
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-blue-600 text-xs font-bold text-white">
                    {source.number}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-5 text-slate-950 dark:text-white">
                      {source.title}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">
                      {source.section || "Body"}
                    </span>
                  </span>
                </button>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-9 mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300"
                  >
                    arXiv:{source.arxiv_id} ↗
                  </a>
                ) : null}
                {active ? (
                  <p className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap border-t border-slate-200 pt-3 pr-1 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    {source.text}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
