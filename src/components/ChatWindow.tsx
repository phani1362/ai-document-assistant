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
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        <FileUpload
          onUploaded={(status) => {
            setUploadStatus(status);
            setAnswer("");
            setSources([]);
            setError(null);
          }}
        />

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Uploaded document
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Current document available for retrieval.
            </p>
          </div>

          {uploadStatus ? (
            <div className="space-y-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
              <p>
                <span className="font-semibold">File:</span>{" "}
                {uploadStatus.fileName}
              </p>
              <p>
                <span className="font-semibold">Chunks created:</span>{" "}
                {uploadStatus.chunkCount}
              </p>
              <p>
                <span className="font-semibold">Status:</span>{" "}
                {uploadStatus.status}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
              No document uploaded yet.
            </div>
          )}
        </section>

        <SourceList sources={sources} />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Ask questions</h2>
          <p className="mt-1 text-sm text-slate-600">
            Answers are generated only from the top retrieved chunks.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleAsk}>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask something about the uploaded document..."
            className="min-h-36 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={isAsking}
            className="inline-flex min-w-32 items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isAsking ? "Thinking..." : "Ask Question"}
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-sm font-semibold text-slate-900">Answer</p>
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {answer || "Your grounded answer will appear here."}
          </p>
        </div>
      </section>
    </div>
  );
}
