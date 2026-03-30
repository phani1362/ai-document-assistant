import { NextResponse } from "next/server";
import { chunkText } from "@/lib/chunk";
import { createEmbeddings } from "@/lib/embeddings";
import { saveDocument } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please upload a TXT file." },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".txt")) {
      return NextResponse.json(
        { error: "Only .txt files are supported for this MVP." },
        { status: 400 },
      );
    }

    const text = (await file.text()).trim();

    if (!text) {
      return NextResponse.json(
        { error: "The uploaded file is empty." },
        { status: 400 },
      );
    }

    const chunks = chunkText(text);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Could not split the uploaded text into chunks." },
        { status: 400 },
      );
    }

    const embeddings = await createEmbeddings(chunks.map((chunk) => chunk.text));
    const savedMetadata = await saveDocument({
      fileName: file.name,
      originalText: text,
      chunks: chunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index],
      })),
    });

    return NextResponse.json({
      fileName: savedMetadata.fileName,
      chunkCount: chunks.length,
      uploadedAt: savedMetadata.uploadedAt,
      status: "ready",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed unexpectedly.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
