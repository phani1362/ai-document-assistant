// Client for the FastAPI backend (backend/app/api). The browser talks to it directly:
// the backend owns retrieval, agents, guardrails, rate limits, and the LLM budget.

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "https://rag-backend-meew.onrender.com"
).replace(/\/$/, "");

export type AgentStep = {
  agent: string;
  detail: string;
};

export type Source = {
  number: number;
  title: string;
  section: string;
  arxiv_id: string | null;
  url: string | null;
  text: string;
};

export type ChatAnswer = {
  answer: string;
  abstained: boolean;
  blocked: boolean;
  route: string;
  sources: Source[];
  verified_sentences: number;
  removed_sentences: number;
  corrective_searches: number;
  steps: AgentStep[];
};

export type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type Paper = {
  id: string;
  external_id: string | null;
  title: string;
  authors: string[];
  url: string | null;
  published_at: string | null;
  chunk_count: number;
};

export class BackendError extends Error {}

async function errorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: unknown };
    if (typeof data.detail === "string") {
      return data.detail;
    }
  } catch {
    // Not JSON; fall through to a generic message.
  }
  return `The backend returned ${response.status}. Please try again.`;
}

function parseEvent(raw: string): { event: string; data: unknown } | null {
  let event = "message";
  const data: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data.push(line.slice(5).trimStart());
    }
  }
  return data.length ? { event, data: JSON.parse(data.join("\n")) } : null;
}

/**
 * Ask a question over Server-Sent Events. `onStep` fires as each agent finishes; the
 * promise resolves with the verified answer (the backend never streams unchecked text).
 */
export async function askQuestion(
  question: string,
  history: HistoryMessage[],
  onStep: (step: AgentStep) => void,
  signal?: AbortSignal,
): Promise<ChatAnswer> {
  const response = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
    signal,
  });
  if (!response.ok) {
    throw new BackendError(await errorMessage(response));
  }
  if (!response.body) {
    throw new BackendError("Streaming is not supported in this browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const raw of events) {
      const parsed = parseEvent(raw);
      if (!parsed) {
        continue;
      }
      if (parsed.event === "step") {
        onStep(parsed.data as AgentStep);
      } else if (parsed.event === "answer") {
        return parsed.data as ChatAnswer;
      } else if (parsed.event === "error") {
        throw new BackendError((parsed.data as { error: string }).error);
      }
    }
  }
  throw new BackendError("The connection closed before an answer arrived. Please try again.");
}

export async function fetchPapers(signal?: AbortSignal): Promise<Paper[]> {
  const response = await fetch(`${API_URL}/documents?status=ready&limit=200`, { signal });
  if (!response.ok) {
    throw new BackendError(await errorMessage(response));
  }
  const page = (await response.json()) as { items: Paper[] };
  return page.items;
}

const WAKE_DEADLINE_MS = 100_000;
const WAKE_RETRY_MS = 3_000;

/**
 * The free backend sleeps when idle; this resolves once it answers (cold start ~30-60 s).
 * While it boots, the host can answer with errors or drop the connection, so keep
 * retrying until the deadline instead of treating the first failure as "down".
 */
export async function waitForBackend(signal?: AbortSignal): Promise<void> {
  const deadline = Date.now() + WAKE_DEADLINE_MS;
  let lastError = "The backend did not respond.";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API_URL}/health`, { signal, cache: "no-store" });
      if (response.ok) {
        return;
      }
      lastError = await errorMessage(response);
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      lastError = "The backend did not respond.";
    }
    await new Promise((resolve) => setTimeout(resolve, WAKE_RETRY_MS));
  }
  throw new BackendError(lastError);
}
