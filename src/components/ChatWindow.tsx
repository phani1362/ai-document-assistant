"use client";

import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { SourceList } from "@/components/SourceList";

type UploadStatus = {
  chunkCount: number;
  fileName: string;
  status: string;
  uploadedAt: string;
};

type Source = {
  id: string;
  index: number;
  score: number;
  text: string;
};

type ChatResponse = {
  answer: string;
  error?: string;
  sources: Source[];
};

const suggestedQuestions = [
  "What is the document mainly about?",
  "List the key requirements.",
  "What details are missing from the document?",
];

export function ChatWindow() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  async function handleAsk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!question.trim()) {
      setError("Enter a question first.");
      return;
    }

    setError(null);
    setIsAsking(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const data = (await response.json()) as ChatResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Question failed.");
      }

      setAnswer(data.answer);
      setSources(data.sources);
      setQuestion("");
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Chat failed.");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="animate-fade-up animate-delay-2 grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
      <aside className="space-y-5">
        <FileUpload
          onUploaded={(status) => {
            setUploadStatus(status);
            setAnswer("");
            setSources([]);
            setError(null);
          }}
        />

        <section className="rounded-[8px] border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-900/5 backdrop-blur">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Uploaded document
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Current document available for grounded Q&A.
              </p>
            </div>
            <span
              className={`rounded-[6px] px-2.5 py-1 text-xs font-semibold ${
                uploadStatus
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                  : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
              }`}
            >
              {uploadStatus ? "Indexed" : "Waiting"}
            </span>
          </div>

          {uploadStatus ? (
            <div className="space-y-3 rounded-[8px] border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-950">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">File</span>
                <span className="max-w-[58%] truncate text-right">
                  {uploadStatus.fileName}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">Chunks created</span>
                <span>{uploadStatus.chunkCount}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">Status</span>
                <span>{uploadStatus.status}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-emerald-800">
                <span className="font-semibold">Uploaded</span>
                <span className="text-right">
                  {new Date(uploadStatus.uploadedAt).toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              No document uploaded yet.
            </div>
          )}
        </section>

        <SourceList sources={sources} />
      </aside>

      <section className="rounded-[8px] border border-slate-200 bg-white/95 p-5 shadow-xl shadow-slate-900/8 backdrop-blur">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Ask questions
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Ask questions about the document and get answers with source
              references.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-[8px] bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
            <span className="h-2 w-2 rounded-full bg-blue-600 glow-pulse" />
            Source references ready
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {suggestedQuestions.map((suggestion) => (
            <button
              className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-600 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              key={suggestion}
              onClick={() => setQuestion(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form className="space-y-4" onSubmit={handleAsk}>
          <label className="block">
            <span className="sr-only">Question</span>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask a question about the uploaded document..."
              className="min-h-40 w-full resize-y rounded-[8px] border border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-950 outline-none ring-0 transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(33,89,242,0.10)]"
            />
          </label>
          <button
            type="submit"
            disabled={isAsking}
            className="group inline-flex min-w-36 items-center justify-center gap-2 rounded-[8px] bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/18 transition hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isAsking ? (
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
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
            )}
            {isAsking ? "Thinking..." : "Ask Question"}
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-[8px] border border-slate-200 bg-slate-950 text-white">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold">Answer</p>
            <span className="rounded-[6px] bg-white/8 px-2 py-1 text-xs font-semibold text-slate-300">
              grounded
            </span>
          </div>
          <div className="relative p-4">
            {isAsking ? (
              <div className="space-y-3">
                <div className="h-3 w-11/12 animate-pulse rounded-full bg-white/12" />
                <div className="h-3 w-9/12 animate-pulse rounded-full bg-white/12" />
                <div className="h-3 w-10/12 animate-pulse rounded-full bg-white/12" />
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
              {answer || "Your accurate answer with source references will appear here."}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
