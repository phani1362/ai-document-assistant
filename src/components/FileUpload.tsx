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
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = inputRef.current?.files?.[0];

    if (!file) {
      setError("Choose a valid text, PDF, or Word document first.");
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
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Upload Document</h2>
        <p className="mt-1 text-sm text-slate-600">
          Supported formats: .txt, .pdf, .docx
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain,.pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
        />

        <button
          type="submit"
          disabled={isUploading}
          className="inline-flex min-w-32 items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isUploading ? "Uploading..." : "Upload Document"}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
