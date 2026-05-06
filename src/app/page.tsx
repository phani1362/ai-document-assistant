import Link from "next/link";

const workflowItems = [
  "Upload a .txt document",
  "Ask questions about the document",
  "Get answers with source references",
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-6 text-slate-950 sm:px-8">
      <div className="animated-grid pointer-events-none absolute inset-x-0 top-0 h-[520px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

      <div className="mobile-safe relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col">
        <header className="animate-fade-up flex min-w-0 items-center justify-between gap-3 border-b border-slate-200/80 pb-5">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[8px] bg-slate-950 text-white shadow-lg shadow-slate-900/10">
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M7 3h7l4 4v14H7V3Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.7"
                />
                <path
                  d="M14 3v5h5M10 12h6M10 16h4"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.7"
                />
              </svg>
            </span>
            <span className="truncate text-sm font-semibold tracking-tight text-slate-900">
              RAG-Powered Document Q&A
            </span>
          </Link>
          <Link
            href="/app"
            className="group inline-flex shrink-0 items-center gap-2 rounded-[8px] border border-slate-300 bg-white/85 px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm shadow-slate-900/5 backdrop-blur transition hover:border-blue-300 hover:text-blue-700 sm:px-4"
          >
            <span className="hidden sm:inline">Open App</span>
            <svg
              aria-hidden="true"
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M5 12h14m-6-6 6 6-6 6"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          </Link>
        </header>

        <section className="grid w-full flex-1 items-center gap-12 py-16 lg:grid-cols-[0.92fr_1.08fr] lg:py-10">
          <div className="mobile-safe min-w-0 max-w-3xl">
            <span className="animate-fade-up inline-flex rounded-[8px] border border-blue-200 bg-white/80 px-3 py-1.5 text-sm font-semibold text-blue-700 shadow-sm shadow-blue-900/5 backdrop-blur">
              RAG-Powered Document Q&A
            </span>
            <div className="mt-7 space-y-6">
              <h1 className="animate-fade-up animate-delay-1 max-w-3xl text-5xl font-semibold leading-[0.95] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
                AI Document Assistant
              </h1>
              <p className="animate-fade-up animate-delay-2 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                Upload a document, ask questions, and get accurate answers
                grounded in the uploaded content with visible source references.
              </p>
            </div>
            <div className="animate-fade-up animate-delay-3 mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/app"
                className="group relative isolate inline-flex items-center gap-2 overflow-hidden rounded-[8px] bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700"
              >
                <span className="absolute inset-y-0 left-0 -z-10 w-10 translate-x-[-120%] rotate-12 bg-white/25 transition duration-700 group-hover:translate-x-[340%]" />
                Open App
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 transition group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M5 12h14m-6-6 6 6-6 6"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              </Link>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.14)]" />
                Visible source references
              </div>
            </div>
          </div>

          <div className="mobile-safe animate-fade-up animate-delay-2 relative min-w-0">
            <div className="animate-float-panel w-full max-w-full rounded-[8px] border border-slate-200 bg-white/90 p-3 shadow-2xl shadow-slate-900/12 backdrop-blur">
              <div className="scan-line relative overflow-hidden rounded-[8px] border border-slate-200 bg-slate-950 p-4 text-white">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                  </div>
                  <p className="text-xs font-medium text-slate-400">
                    retrieval-console
                  </p>
                </div>

                <div className="grid min-w-0 gap-3 md:grid-cols-[0.88fr_1.12fr]">
                  <div className="min-w-0 rounded-[8px] border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-sm font-semibold text-white">
                      What You Can Do
                    </p>
                    <ul className="mt-4 space-y-3">
                      {workflowItems.map((item, index) => (
                        <li
                          className="flex items-start gap-3 text-sm leading-6 text-slate-300"
                          key={item}
                        >
                          <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] bg-blue-500/16 text-[11px] font-bold text-blue-200 ring-1 ring-blue-300/20">
                            {index + 1}
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="min-w-0 space-y-3">
                    <div className="rounded-[8px] border border-blue-300/20 bg-blue-500/10 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-semibold text-blue-100">
                          Document indexed
                        </p>
                        <span className="rounded-[6px] bg-emerald-400/15 px-2 py-1 text-xs font-semibold text-emerald-200">
                          ready
                        </span>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-blue-300 via-cyan-200 to-emerald-300" />
                      </div>
                    </div>

                    <div className="rounded-[8px] border border-white/10 bg-white p-4 text-slate-950">
                      <p className="text-sm font-semibold">Answer Policy</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        The assistant provides grounded answers from the
                        uploaded document and clearly states when the answer is
                        not available in the source content.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 pt-3 sm:grid-cols-3">
                {["Upload", "Ask", "Reference"].map((label) => (
                  <div
                    className="rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3"
                    key={label}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Step
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <svg
              aria-hidden="true"
              className="pointer-events-none absolute -left-10 top-12 hidden h-44 w-44 text-blue-500/35 lg:block"
              fill="none"
              viewBox="0 0 180 180"
            >
              <path
                className="trace-line"
                d="M14 118 C48 22 112 162 164 54"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
              />
            </svg>
          </div>
        </section>
      </div>
    </main>
  );
}
