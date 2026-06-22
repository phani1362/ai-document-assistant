import OpenAI from "openai";

// Google Gemini exposes an OpenAI-compatible API, so we reuse the official
// `openai` SDK and simply point it at Gemini's endpoint. This keeps the rest of
// the codebase unchanged while running on Gemini's free tier (chat + embeddings).
const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL ??
  "https://generativelanguage.googleapis.com/v1beta/openai/";

let client: OpenAI | null = null;

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY. Get a free key at https://aistudio.google.com/apikey and add it to your .env.local file.",
    );
  }

  if (!client) {
    client = new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL });
  }

  return client;
}
