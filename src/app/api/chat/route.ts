import { NextResponse } from "next/server";
import { toClientError } from "@/lib/api-errors";
import {
  streamChatCompletion,
  type ChatMessage,
} from "@/lib/embeddings";
import { runAgenticRetrieval } from "@/lib/agentic-rag";
import { checkChatRateLimit, getRequestIdentifier } from "@/lib/rate-limit";
import { hasDocument } from "@/lib/store";
import { logUsageEvent } from "@/lib/usage";

const SYSTEM_PROMPT =
  "You are a document question-answering assistant. Answer only from the provided sources and do not use outside knowledge. Cite factual claims inline with [Source N]. If the evidence is incomplete or conflicting, say so explicitly. If the answer is absent, clearly say you could not find it in the uploaded documents. Prior turns help resolve follow-ups but are not evidence.";

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

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const { chunks: topChunks, answerPrompt } =
            await runAgenticRetrieval({
              question,
              history,
              documentId,
              onStep: (step) =>
                controller.enqueue(encoder.encode(sseEvent("agent", step))),
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
          controller.enqueue(encoder.encode(sseEvent("sources", { sources })));
          const completionStream = await streamChatCompletion({
            systemPrompt: SYSTEM_PROMPT,
            userPrompt: answerPrompt,
            history,
          });

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
