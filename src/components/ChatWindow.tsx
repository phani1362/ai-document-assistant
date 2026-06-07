"use client";

import { useState } from "react";
import { DocumentList } from "@/components/DocumentList";
import { FileUpload } from "@/components/FileUpload";
import { SourceList } from "@/components/SourceList";
import { UsagePanel } from "@/components/UsagePanel";

type UploadStatus = {
  id: string;
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
  documentId: string;
  fileName: string;
  page?: number;
};

type ChatErrorResponse = {
  error?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

type FeedbackVote = "up" | "down";

const suggestedQuestions = [
  "What is the document mainly about?",
  "List the key requirements.",
  "What details are missing from the document?",
];

export function ChatWindow() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [documentsRefreshKey, setDocumentsRefreshKey] = useState(0);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [isStreamingAnswer, setIsStreamingAnswer] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, FeedbackVote>>({});

  const latestSources =
    [...messages].reverse().find((message) => message.sources)?.sources ?? [];
  const latestQuestion =
    [...messages].reverse().find((message) => message.role === "user")?.content ?? "";

  function resetConversation() {
    setMessages([]);
    setError(null);
    setFeedback({});
  }

  async function submitFeedback(messageIndex: number, vote: FeedbackVote) {
    const assistantMessage = messages[messageIndex];
    const question = messages[messageIndex - 1]?.content ?? "";

    if (!assistantMessage || assistantMessage.role !== "assistant") {
      return;
    }

    setFeedback((current) => ({ ...current, [messageIndex]: vote }));

    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vote,
          question,
          answer: assistantMessage.content,
          documentId: selectedDocumentId,
        }),
      });
    } catch {
      // Feedback is best-effort; ignore network failures.
    }
  }

  function exportConversation() {
    const lines = messages.map((message) =>
      message.role === "user" ? `**You:** ${message.content}` : `**Assistant:** ${message.content}`,
    );
    const markdown = `# Conversation export\n\n${lines.join("\n\n")}\n`;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `conversation-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleAsk(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      setError("Enter a question first.");
      return;
    }

    setError(null);
    setIsAsking(true);
    setIsStreamingAnswer(false);
    setQuestion("");

    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((current) => [
      ...current,
      { role: "user", content: trimmedQuestion },
      { role: "assistant", content: "" },
    ]);

    function updateAssistantMessage(updater: (message: ChatMessage) => ChatMessage) {
      setMessages((current) => {
        const next = [...current];
        const lastIndex = next.length - 1;
        next[lastIndex] = updater(next[lastIndex]);
        return next;
      });
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          documentId: selectedDocumentId,
          history,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as ChatErrorResponse;
        throw new Error(data.error ?? "Question failed.");
      }

      if (!response.body) {
        throw new Error("Streaming is not supported in this browser.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          const eventMatch = rawEvent.match(/^event: (.+)$/m);
          const dataMatch = rawEvent.match(/^data: (.+)$/m);

          if (!eventMatch || !dataMatch) {
            continue;
          }

          const eventName = eventMatch[1];
          const payload = JSON.parse(dataMatch[1]);

          if (eventName === "sources") {
            const sources = payload.sources as Source[];
            updateAssistantMessage((message) => ({ ...message, sources }));
          } else if (eventName === "delta") {
            setIsStreamingAnswer(true);
            const delta = payload.delta as string;
            updateAssistantMessage((message) => ({
              ...message,
              content: message.content + delta,
            }));
          } else if (eventName === "error") {
            streamError = payload.error as string;
          }
        }
      }

      if (streamError) {
        throw new Error(streamError);
      }
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Chat failed.");
      setMessages((current) => current.slice(0, -1));
    } finally {
      setIsAsking(false);
      setIsStreamingAnswer(false);
    }
  }

  return (
    <div className="animate-fade-up animate-delay-2 grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
      <aside className="space-y-5">
        <FileUpload
          onUploaded={(status) => {
            setUploadStatus(status);
            resetConversation();
            setSelectedDocumentId(status.id);
            setDocumentsRefreshKey((key) => key + 1);
          }}
        />

        {uploadStatus ? (
          <p className="rounded-[8px] border border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            Indexed “{uploadStatus.fileName}” into {uploadStatus.chunkCount} chunks.
          </p>
        ) : null}

        <DocumentList
          refreshKey={documentsRefreshKey}
          selectedId={selectedDocumentId}
          onSelect={(id) => {
            setSelectedDocumentId(id);
            resetConversation();
          }}
          onDeleted={(id) => {
            if (selectedDocumentId === id) {
              setSelectedDocumentId(null);
            }
            if (uploadStatus?.id === id) {
              setUploadStatus(null);
            }
          }}
        />

        <SourceList sources={latestSources} question={latestQuestion} />

        <UsagePanel />
      </aside>

      <section className="rounded-[8px] border border-slate-200 bg-white/95 p-5 shadow-xl shadow-slate-900/8 backdrop-blur dark:border-slate-700 dark:bg-slate-900/70">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
              Ask questions
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Ask follow-up questions — the assistant remembers this
              conversation and grounds every answer in the document.
            </p>
          </div>
          {messages.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportConversation}
                className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:border-blue-400/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
              >
                Export conversation
              </button>
              <button
                type="button"
                onClick={resetConversation}
                className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:border-orange-400/30 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
              >
                Clear conversation
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-[8px] bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:ring-slate-700">
              <span className="h-2 w-2 rounded-full bg-blue-600 glow-pulse" />
              Source references ready
            </div>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {suggestedQuestions.map((suggestion) => (
            <button
              className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-600 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:border-blue-400/30 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
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
              className="min-h-32 w-full resize-y rounded-[8px] border border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-950 outline-none ring-0 transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:shadow-[0_0_0_4px_rgba(33,89,242,0.10)] dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:bg-slate-800"
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
          <p className="mt-4 rounded-[8px] border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-300">
            {error}
          </p>
        ) : null}

        <div className="mt-6 overflow-hidden rounded-[8px] border border-slate-200 bg-slate-950 text-white dark:border-slate-700">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold">Conversation</p>
            <span className="rounded-[6px] bg-white/8 px-2 py-1 text-xs font-semibold text-slate-300">
              grounded
            </span>
          </div>
          <div className="max-h-[28rem] space-y-4 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
                Your accurate answer with source references will appear here.
              </p>
            ) : (
              messages.map((message, messageIndex) => {
                const isLastAssistantMessage =
                  message.role === "assistant" && messageIndex === messages.length - 1;
                const showSkeleton =
                  isLastAssistantMessage &&
                  isAsking &&
                  !isStreamingAnswer &&
                  message.content === "";

                return (
                  <div
                    key={messageIndex}
                    className={
                      message.role === "user"
                        ? "ml-auto max-w-[85%] rounded-[8px] bg-blue-600/90 px-4 py-2.5 text-sm leading-6 text-white"
                        : "mr-auto max-w-[92%] rounded-[8px] bg-white/8 px-4 py-2.5 text-sm leading-7 text-slate-200"
                    }
                  >
                    {showSkeleton ? (
                      <div className="space-y-3 py-1">
                        <div className="h-3 w-11/12 animate-pulse rounded-full bg-white/12" />
                        <div className="h-3 w-9/12 animate-pulse rounded-full bg-white/12" />
                        <div className="h-3 w-10/12 animate-pulse rounded-full bg-white/12" />
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">
                        {message.content}
                        {isLastAssistantMessage && isStreamingAnswer ? (
                          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-blue-400 align-text-bottom" />
                        ) : null}
                      </p>
                    )}

                    {message.role === "assistant" && message.content && !showSkeleton ? (
                      <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2.5">
                        <span className="text-xs font-medium text-slate-400">
                          Helpful?
                        </span>
                        <button
                          type="button"
                          onClick={() => submitFeedback(messageIndex, "up")}
                          aria-label="Mark answer as helpful"
                          className={`grid h-7 w-7 place-items-center rounded-[6px] text-base transition ${
                            feedback[messageIndex] === "up"
                              ? "bg-emerald-400/20 text-emerald-300"
                              : "text-slate-400 hover:bg-white/10 hover:text-emerald-300"
                          }`}
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          onClick={() => submitFeedback(messageIndex, "down")}
                          aria-label="Mark answer as not helpful"
                          className={`grid h-7 w-7 place-items-center rounded-[6px] text-base transition ${
                            feedback[messageIndex] === "down"
                              ? "bg-orange-400/20 text-orange-300"
                              : "text-slate-400 hover:bg-white/10 hover:text-orange-300"
                          }`}
                        >
                          👎
                        </button>
                        {feedback[messageIndex] ? (
                          <span className="text-xs font-medium text-slate-400">
                            Thanks for the feedback!
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
