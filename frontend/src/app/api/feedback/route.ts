import { NextResponse } from "next/server";
import { toClientError } from "@/lib/api-errors";
import { logFeedbackEvent, type FeedbackVote } from "@/lib/feedback";

type FeedbackRequestBody = {
  vote?: FeedbackVote;
  question?: string;
  answer?: string;
  documentId?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeedbackRequestBody;

    if (body.vote !== "up" && body.vote !== "down") {
      return NextResponse.json({ error: "Invalid feedback vote." }, { status: 400 });
    }

    if (!body.question || !body.answer) {
      return NextResponse.json(
        { error: "A question and answer are required." },
        { status: 400 },
      );
    }

    await logFeedbackEvent({
      vote: body.vote,
      question: body.question,
      answer: body.answer,
      documentId: body.documentId ?? null,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const clientError = toClientError(error, "Failed to record feedback.");

    return NextResponse.json(
      { error: clientError.error },
      { status: clientError.status },
    );
  }
}
