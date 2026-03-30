import { NextResponse } from "next/server";
import { createChatCompletion, createQueryEmbedding } from "@/lib/embeddings";
import { retrieveRelevantChunks } from "@/lib/retrieval";
import { hasDocument } from "@/lib/store";

const SYSTEM_PROMPT =
  "You are a document question-answering assistant. Answer only from the provided context. Do not use outside knowledge. If the answer is not in the context, clearly say you could not find it in the uploaded document.";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { question?: string };
    const question = body.question?.trim();

    if (!question) {
      return NextResponse.json(
        { error: "Please enter a question." },
        { status: 400 },
      );
    }

    const isDocumentAvailable = await hasDocument();

    if (!isDocumentAvailable) {
      return NextResponse.json(
        { error: "Upload a TXT file before asking a question." },
        { status: 400 },
      );
    }

    const queryEmbedding = await createQueryEmbedding(question);
    const topChunks = await retrieveRelevantChunks(queryEmbedding, 3);

    const context = topChunks
      .map(
        (chunk, index) =>
          `Source ${index + 1} (chunk ${chunk.index + 1}):\n${chunk.text}`,
      )
      .join("\n\n");

    const answer = await createChatCompletion({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Question:\n${question}\n\nContext:\n${context}`,
    });

    return NextResponse.json({
      answer,
      sources: topChunks.map((chunk) => ({
        id: chunk.id,
        index: chunk.index,
        text: chunk.text,
        score: chunk.score,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Chat request failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
