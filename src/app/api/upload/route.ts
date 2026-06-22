import { NextResponse } from "next/server";
import { toClientError } from "@/lib/api-errors";
import { chunkPages, chunkText, type TextChunk } from "@/lib/chunk";
import { createEmbeddings } from "@/lib/embeddings";
import { checkUploadRateLimit, getRequestIdentifier } from "@/lib/rate-limit";
import { saveDocument } from "@/lib/store";
import { logUsageEvent } from "@/lib/usage";
import mammoth from "mammoth";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const identifier = getRequestIdentifier(request);
    const { success } = await checkUploadRateLimit(identifier);

    if (!success) {
      return NextResponse.json(
        { error: "Too many uploads in a short time. Wait a few minutes and try again." },
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please upload a valid document." },
        { status: 400 },
      );
    }

    const fileName = file.name.toLowerCase();
    const supportedExtensions = [".txt", ".md", ".csv", ".pdf", ".docx"];

    if (!supportedExtensions.some((extension) => fileName.endsWith(extension))) {
      return NextResponse.json(
        { error: "Only .txt, .md, .csv, .pdf, and .docx files are supported." },
        { status: 400 },
      );
    }

    let text = "";
    let chunks: TextChunk[] = [];

    try {
      if (
        fileName.endsWith(".txt") ||
        fileName.endsWith(".md") ||
        fileName.endsWith(".csv")
      ) {
        text = (await file.text()).trim();
        chunks = chunkText(text);
      } else if (fileName.endsWith(".pdf")) {
        // unpdf is serverless-friendly (no canvas/DOMMatrix deps), unlike
        // pdf-parse/pdfjs which crashes on Vercel's Node runtime.
        const { extractText, getDocumentProxy } = await import("unpdf");
        const buffer = new Uint8Array(await file.arrayBuffer());
        const pdf = await getDocumentProxy(buffer);
        const { text: pageTexts } = await extractText(pdf, {
          mergePages: false,
        });
        text = pageTexts.join("\n\n").trim();
        chunks = chunkPages(
          pageTexts.map((pageText, pageIndex) => ({
            page: pageIndex + 1,
            text: pageText,
          })),
        );
      } else if (fileName.endsWith(".docx")) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await mammoth.extractRawText({ buffer });
        text = result.value.trim();
        chunks = chunkText(text);
      }
    } catch (parseError) {
      console.error("Document parse error:", parseError);
      return NextResponse.json(
        {
          error:
            "Failed to read the file contents. The file may be corrupt or encrypted.",
        },
        { status: 400 },
      );
    }

    if (!text) {
      return NextResponse.json(
        { error: "The uploaded file is empty." },
        { status: 400 },
      );
    }

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

    await logUsageEvent({
      route: "upload",
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      id: savedMetadata.id,
      fileName: savedMetadata.fileName,
      chunkCount: savedMetadata.chunkCount,
      uploadedAt: savedMetadata.uploadedAt,
      status: "ready",
    });
  } catch (error) {
    const clientError = toClientError(error, "Upload failed unexpectedly.");

    return NextResponse.json(
      { error: clientError.error },
      { status: clientError.status },
    );
  }
}
