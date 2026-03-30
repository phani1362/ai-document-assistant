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
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Source chunks</h2>
        <p className="mt-1 text-sm text-slate-600">
          These are the retrieved passages used to answer the latest question.
        </p>
      </div>

      {sources.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Ask a question after uploading a document to see source text here.
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <article
              key={source.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">
                  Chunk {source.index + 1}
                </p>
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                  score {source.score.toFixed(3)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {source.text}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
