import { NextResponse } from "next/server";
import { toClientError } from "@/lib/api-errors";
import {
  createQueryEmbedding,
  streamChatCompletion,
  type ChatMessage,
} from "@/lib/embeddings";
import { checkChatRateLimit, getRequestIdentifier } from "@/lib/rate-limit";
import { retrieveRelevantChunks } from "@/lib/retrieval";
import { hasDocument } from "@/lib/store";
import { logUsageEvent } from "@/lib/usage";

const SYSTEM_PROMPT =
  "You are a document question-answering assistant. Answer only from the provided context. Do not use outside knowledge. If the answer is not in the context, clearly say you could not find it in the uploaded document. Prior conversation turns are provided for follow-up context only — keep grounding every answer in the supplied document context.";

const MAX_HISTORY_TURNS = 6;

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const identifier = getRequestIdentifier(request);
    const { success } = await checkChatRateLimit(identifier);

    if (!success) {
      return NextResponse.json(
        { error: "You're asking questions too quickly. Wait a minute and try again." },
        { status: 429 },
      );
    }

    const body = (await request.json()) as {
      question?: string;
      documentId?: string;
      history?: ChatMessage[];
    };
    const question = body.question?.trim();
    const documentId = body.documentId?.trim() || undefined;
    const history = Array.isArray(body.history)
      ? body.history
          .filter(
            (message): message is ChatMessage =>
              (message?.role === "user" || message?.role === "assistant") &&
              typeof message?.content === "string" &&
              message.content.trim().length > 0,
          )
          .slice(-MAX_HISTORY_TURNS * 2)
      : [];

    if (!question) {
      return NextResponse.json(
        { error: "Please enter a question." },
        { status: 400 },
      );
    }

    const isDocumentAvailable = await hasDocument();

    if (!isDocumentAvailable) {
      return NextResponse.json(
        { error: "Upload a document before asking a question." },
        { status: 400 },
      );
    }

    const queryEmbedding = await createQueryEmbedding(question);
    const topChunks = await retrieveRelevantChunks(queryEmbedding, 3, documentId);

    const context = topChunks
      .map((chunk, index) => {
        const location = chunk.page
          ? `page ${chunk.page}`
          : `chunk ${chunk.index + 1}`;
        return `Source ${index + 1} (${chunk.fileName}, ${location}):\n${chunk.text}`;
      })
      .join("\n\n");

    const completionStream = await streamChatCompletion({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Question:\n${question}\n\nContext:\n${context}`,
      history,
    });

    const sources = topChunks.map((chunk) => ({
      id: chunk.id,
      index: chunk.index,
      text: chunk.text,
      score: chunk.score,
      documentId: chunk.documentId,
      fileName: chunk.fileName,
      page: chunk.page,
    }));

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(sseEvent("sources", { sources })));

        try {
          for await (const chunk of completionStream) {
            const delta = chunk.choices[0]?.delta?.content;

            if (delta) {
              controller.enqueue(encoder.encode(sseEvent("delta", { delta })));
            }
          }

          controller.enqueue(encoder.encode(sseEvent("done", {})));
          await logUsageEvent({
            route: "chat",
            latencyMs: Date.now() - startedAt,
            timestamp: new Date().toISOString(),
          });
        } catch (streamError) {
          const clientError = toClientError(streamError, "Chat request failed.");
          controller.enqueue(
            encoder.encode(sseEvent("error", { error: clientError.error })),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const clientError = toClientError(error, "Chat request failed.");

    return NextResponse.json(
      { error: clientError.error },
      { status: clientError.status },
    );
  }
}
