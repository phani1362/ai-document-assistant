"use client";

import { useRef, useState } from "react";

type UploadStatus = {
  chunkCount: number;
  fileName: string;
  status: string;
  uploadedAt: string;
};

type FileUploadProps = {
  onUploaded: (status: UploadStatus) => void;
};

export function FileUpload({ onUploaded }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = inputRef.current?.files?.[0];

    if (!file) {
      setError("Choose a valid document (.txt, .pdf, or .docx).");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as UploadStatus & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }

      onUploaded(data);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-[8px] border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-900/5 backdrop-blur">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-blue-50 text-blue-700 ring-1 ring-blue-100">
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="M12 16V4m0 0 4 4m-4-4-4 4M5 16v3h14v-3"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </span>
        <div>
          <h2 className="text-base font-semibold text-slate-950">
            Upload Document
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Upload a .txt, .pdf, or .docx file
          </p>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="group relative block cursor-pointer overflow-hidden rounded-[8px] border border-dashed border-slate-300 bg-slate-50 p-5 transition hover:border-blue-300 hover:bg-blue-50/40">
          <input
            ref={inputRef}
            type="file"
            accept=".txt,text/plain,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(event) =>
              setSelectedFileName(event.currentTarget.files?.[0]?.name ?? "")
            }
          />
          <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 transition group-hover:opacity-100" />
          <span className="flex items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-semibold text-slate-900">
                {selectedFileName || "Choose a document"}
              </span>
              <span className="mt-1 block text-sm text-slate-500">
                The document is indexed for grounded answers.
              </span>
            </span>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 transition group-hover:-translate-y-0.5">
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={isUploading}
          className="group inline-flex min-w-40 items-center justify-center gap-2 rounded-[8px] bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/12 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isUploading ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <svg
              aria-hidden="true"
              className="h-4 w-4 transition group-hover:-translate-y-0.5"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 16V4m0 0 4 4m-4-4-4 4M5 20h14"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
              />
            </svg>
          )}
          {isUploading ? "Uploading..." : "Upload Document"}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
