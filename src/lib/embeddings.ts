import { getOpenAIClient } from "@/lib/openai";

const DEFAULT_EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const DEFAULT_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini";

export async function createEmbeddings(texts: string[]) {
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: DEFAULT_EMBEDDING_MODEL,
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}

export async function createQueryEmbedding(text: string) {
  const [embedding] = await createEmbeddings([text]);
  return embedding;
}

type ChatCompletionParams = {
  systemPrompt: string;
  userPrompt: string;
};

export async function createChatCompletion({
  systemPrompt,
  userPrompt,
}: ChatCompletionParams) {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: DEFAULT_CHAT_MODEL,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  return (
    response.choices[0]?.message.content?.trim() ??
    "I could not find that information in the uploaded document."
  );
}
