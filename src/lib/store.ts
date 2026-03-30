import { Index } from "@upstash/vector";
import type { TextChunk } from "@/lib/chunk";

export type StoredChunk = TextChunk & {
  embedding: number[];
};

export type StoredDocument = {
  chunks: StoredChunk[];
  fileName: string;
  originalText: string;
};

// Initialize Upstash Vector Index
// Note: Requires UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN in .env.local
// Helper to get index lazily so Next.js build doesn't crash if env vars are misconfigured
function getIndex() {
  return new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL!,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
  });
}

export async function saveDocument(document: StoredDocument) {
  // Clear the existing index for MVP purpose (so we only have the newest document)
  await getIndex().reset();

  // Prepare chunks to be Upserted
  const vectors = document.chunks.map((chunk) => ({
    id: `chunk-${chunk.index}`,
    vector: chunk.embedding,
    metadata: {
      text: chunk.text,
      fileName: document.fileName,
      index: chunk.index,
    },
  }));

  // Upsert in batches of 100 to respect Upstash payload limits
  for (let i = 0; i < vectors.length; i += 100) {
    const batch = vectors.slice(i, i + 100);
    await getIndex().upsert(batch);
  }

  return {
    fileName: document.fileName,
    uploadedAt: new Date().toISOString(),
  };
}

export async function hasDocument() {
  const stats = await getIndex().info();
  return stats.vectorCount > 0;
}
