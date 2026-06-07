type Source = {
  id: string;
  index: number;
  score: number;
  text: string;
  documentId: string;
  fileName: string;
  page?: number;
};

type SourceListProps = {
  sources: Source[];
  question?: string;
};

const STOP_WORDS = new Set([
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "whose",
  "why",
  "how",
  "this",
  "that",
  "these",
  "those",
  "with",
  "from",
  "about",
  "into",
  "your",
  "their",
  "there",
  "have",
  "does",
  "doing",
  "list",
  "details",
  "missing",
  "main",
  "mainly",
  "document",
  "the",
  "and",
  "for",
]);

function getHighlightTerms(question: string): string[] {
  const terms = question
    .toLowerCase()
    .match(/[a-z0-9]{4,}/g)
    ?.filter((term) => !STOP_WORDS.has(term));

  return Array.from(new Set(terms ?? [])).slice(0, 8);
}

function highlightText(text: string, terms: string[]) {
  if (terms.length === 0) {
    return text;
  }

  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const splitPattern = new RegExp(`(${escaped})`, "gi");
  const testPattern = new RegExp(`^(${escaped})$`, "i");
  const parts = text.split(splitPattern);

  return parts.map((part, index) =>
    testPattern.test(part) ? (
      <mark
        key={index}
        className="rounded-[3px] bg-amber-200/70 px-0.5 text-slate-950 dark:bg-amber-400/30 dark:text-amber-100"
      >
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export function SourceList({ sources, question = "" }: SourceListProps) {
  const highlightTerms = getHighlightTerms(question);

  return (
    <section className="rounded-[8px] border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/60 dark:shadow-black/20">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">
            Source references
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
            These are the document references used to answer the latest
            question.
          </p>
        </div>
        <span className="rounded-[6px] bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/20">
          {sources.length}
        </span>
      </div>

      {sources.length === 0 ? (
        <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          Ask a question after uploading a document to see source references
          here.
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <article
              key={source.id}
              className="group rounded-[8px] border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-blue-400/30 dark:hover:bg-slate-800"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-semibold text-slate-950 dark:text-white">
                  {source.fileName ? `${source.fileName} · ` : ""}
                  {source.page ? `Page ${source.page}` : `Chunk ${source.index + 1}`}
                </p>
                <span className="shrink-0 rounded-[6px] bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-slate-200 transition group-hover:ring-blue-100 dark:bg-slate-900 dark:text-blue-300 dark:ring-slate-700 dark:group-hover:ring-blue-400/30">
                  score {source.score.toFixed(3)}
                </span>
              </div>
              <p className="max-h-56 overflow-auto whitespace-pre-wrap pr-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {highlightText(source.text, highlightTerms)}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
