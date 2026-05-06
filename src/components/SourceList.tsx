type Source = {
  id: string;
  index: number;
  score: number;
  text: string;
};

type SourceListProps = {
  sources: Source[];
};

export function SourceList({ sources }: SourceListProps) {
  return (
    <section className="rounded-[8px] border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-900/5 backdrop-blur">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Source references
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            These are the document references used to answer the latest
            question.
          </p>
        </div>
        <span className="rounded-[6px] bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
          {sources.length}
        </span>
      </div>

      {sources.length === 0 ? (
        <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500">
          Ask a question after uploading a document to see source references
          here.
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <article
              key={source.id}
              className="group rounded-[8px] border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950">
                  Chunk {source.index + 1}
                </p>
                <span className="rounded-[6px] bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-slate-200 transition group-hover:ring-blue-100">
                  score {source.score.toFixed(3)}
                </span>
              </div>
              <p className="max-h-56 overflow-auto whitespace-pre-wrap pr-1 text-sm leading-6 text-slate-600">
                {source.text}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
