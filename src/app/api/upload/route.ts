import { NextResponse } from "next/server";
import { chunkText } from "@/lib/chunk";
import { createEmbeddings } from "@/lib/embeddings";
import { saveDocument } from "@/lib/store";
import mammoth from "mammoth";
const pdfParse = require("pdf-parse");

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please upload a valid document." },
        { status: 400 },
      );
    }

    const fileName = file.name.toLowerCase();
    
    if (
      !fileName.endsWith(".txt") &&
      !fileName.endsWith(".pdf") &&
      !fileName.endsWith(".docx")
    ) {
      return NextResponse.json(
        { error: "Only .txt, .pdf, and .docx files are supported." },
        { status: 400 },
      );
    }

    let text = "";

    try {
      if (fileName.endsWith(".txt")) {
        text = (await file.text()).trim();
      } else if (fileName.endsWith(".pdf")) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const pdfData = await pdfParse(buffer);
        text = pdfData.text.trim();
      } else if (fileName.endsWith(".docx")) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await mammoth.extractRawText({ buffer });
        text = result.value.trim();
      }
    } catch (parseError) {
      console.error("Document parse error:", parseError);
      return NextResponse.json(
        { error: "Failed to read the file contents. The file may be corrupt or encrypted." },
        { status: 400 },
      );
    }

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
