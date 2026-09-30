import Link from "next/link";
import { ChatWindow } from "@/components/ChatWindow";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AppPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-6 sm:px-8">
      <div className="animated-grid pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
      <div className="mobile-safe relative mx-auto w-full max-w-7xl">
        <header className="animate-fade-up mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-5 dark:border-slate-700/80">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-[8px] bg-slate-950 text-white shadow-lg shadow-slate-900/10 dark:bg-blue-600">
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
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-white">
                AI Document Assistant
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                RAG-Powered Document Q&A
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        <section className="animate-fade-up animate-delay-1 mb-8 grid gap-6 lg:grid-cols-[1fr_0.74fr] lg:items-end">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700 dark:text-blue-400">
              RAG-Powered Document Q&A
            </p>
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
              Upload a document, ask questions, and get accurate answers
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-400">
              Answers are grounded in the uploaded content with visible source
              references.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-[8px] border border-slate-200 bg-white/80 p-3 shadow-sm shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/60">
            {[
              ["Upload", ".txt, .md, .csv, .pdf, .docx"],
              ["Ask", "document Q&A"],
              ["Sources", "references"],
            ].map(([label, value]) => (
              <div className="rounded-[8px] bg-slate-50 p-3 dark:bg-slate-800/60" key={label}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <ChatWindow />
      </div>
    </main>
  );
}
