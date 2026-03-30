import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16">
      <section className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div className="space-y-6">
          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
            Working RAG MVP
          </span>
          <div className="space-y-4">
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-900 md:text-6xl">
              AI Document Assistant
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              Upload a plain text file, ask questions about it, and get answers
              grounded only in the uploaded content with visible source chunks.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Open App
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">
                What you can do
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>Upload one `.txt` document</li>
                <li>Ask questions about its contents</li>
                <li>See the source text used for each answer</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-slate-900 p-4 text-sm text-slate-100">
              <p className="font-medium">Answer policy</p>
              <p className="mt-2 leading-6 text-slate-300">
                The assistant is instructed to answer only from retrieved
                document context and say when the document does not contain the
                answer.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
