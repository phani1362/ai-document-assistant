import { getGeminiClient } from "@/lib/openai";

// Free Gemini models. gemini-embedding-001 supports configurable output sizes;
// we pin it to 1536 dims to match the Upstash Vector index dimension.
const DEFAULT_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL ??
  process.env.OPENAI_EMBEDDING_MODEL ??
  "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = Number(
  process.env.GEMINI_EMBEDDING_DIMENSIONS ?? "1536",
);
const DEFAULT_CHAT_MODEL =
  process.env.GEMINI_CHAT_MODEL ??
  process.env.OPENAI_CHAT_MODEL ??
  "gemini-2.5-flash";

export async function createEmbeddings(texts: string[]) {
  const client = getGeminiClient();
  const response = await client.embeddings.create({
    model: DEFAULT_EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data.map((item) => item.embedding);
}

export async function createQueryEmbedding(text: string) {
  const [embedding] = await createEmbeddings([text]);
  return embedding;
}

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatCompletionParams = {
  systemPrompt: string;
  userPrompt: string;
  history?: ChatMessage[];
};

function buildMessages({ systemPrompt, userPrompt, history }: ChatCompletionParams) {
  return [
    { role: "system" as const, content: systemPrompt },
    ...(history ?? []).map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: "user" as const, content: userPrompt },
  ];
}

export async function createChatCompletion(params: ChatCompletionParams) {
  const client = getGeminiClient();
  const response = await client.chat.completions.create({
    model: DEFAULT_CHAT_MODEL,
    temperature: 0,
    messages: buildMessages(params),
  });

  return (
    response.choices[0]?.message.content?.trim() ??
    "I could not find that information in the uploaded document."
  );
}

export async function streamChatCompletion(params: ChatCompletionParams) {
  const client = getGeminiClient();

  return client.chat.completions.create({
    model: DEFAULT_CHAT_MODEL,
    temperature: 0,
    stream: true,
    messages: buildMessages(params),
  });
}
