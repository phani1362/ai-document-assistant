import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Add it to your .env.local file.");
  }

  if (!client) {
    client = new OpenAI({ apiKey });
  }

  return client;
}
