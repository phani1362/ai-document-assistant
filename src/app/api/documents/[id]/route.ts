import { NextResponse } from "next/server";
import { toClientError } from "@/lib/api-errors";
import { deleteDocument } from "@/lib/store";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Missing document id." }, { status: 400 });
    }

    await deleteDocument(id);

    return NextResponse.json({ status: "deleted", id });
  } catch (error) {
    const clientError = toClientError(error, "Failed to delete document.");

    return NextResponse.json(
      { error: clientError.error },
      { status: clientError.status },
    );
  }
}
