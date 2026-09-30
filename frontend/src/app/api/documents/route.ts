import { NextResponse } from "next/server";
import { toClientError } from "@/lib/api-errors";
import { listDocuments } from "@/lib/store";

export async function GET() {
  try {
    const documents = await listDocuments();

    return NextResponse.json({ documents });
  } catch (error) {
    const clientError = toClientError(error, "Failed to load documents.");

    return NextResponse.json(
      { error: clientError.error },
      { status: clientError.status },
    );
  }
}
