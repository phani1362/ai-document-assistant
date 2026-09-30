import { Index } from "@upstash/vector";
import { randomUUID } from "crypto";
import { getRedis } from "@/lib/redis";
import type { TextChunk } from "@/lib/chunk";

export type StoredChunk = TextChunk & {
  embedding: number[];
};

export type StoredDocument = {
  chunks: StoredChunk[];
  fileName: string;
  originalText: string;
};

export type DocumentSummary = {
  id: string;
  fileName: string;
  uploadedAt: string;
  chunkCount: number;
};

const REGISTRY_KEY = "documents:registry";

// Initialize Upstash Vector Index
// Note: Requires UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN in .env.local
// Helper to get index lazily so Next.js build doesn't crash if env vars are misconfigured
function getIndex() {
  return new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL!,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
  });
}

async function getRegistry(): Promise<DocumentSummary[]> {
  const registry = await getRedis().get<DocumentSummary[]>(REGISTRY_KEY);
  return registry ?? [];
}

async function setRegistry(registry: DocumentSummary[]) {
  await getRedis().set(REGISTRY_KEY, registry);
}

export async function saveDocument(document: StoredDocument) {
  const id = randomUUID();
  const namespace = getIndex().namespace(id);

  // Prepare chunks to be Upserted
  const vectors = document.chunks.map((chunk) => ({
    id: `chunk-${chunk.index}`,
    vector: chunk.embedding,
    metadata: {
      text: chunk.text,
      fileName: document.fileName,
      index: chunk.index,
      ...(chunk.page !== undefined ? { page: chunk.page } : {}),
    },
  }));

  // Upsert in batches of 100 to respect Upstash payload limits
  for (let i = 0; i < vectors.length; i += 100) {
    const batch = vectors.slice(i, i + 100);
    await namespace.upsert(batch);
  }

  const summary: DocumentSummary = {
    id,
    fileName: document.fileName,
    uploadedAt: new Date().toISOString(),
    chunkCount: document.chunks.length,
  };

  const registry = await getRegistry();
  registry.unshift(summary);
  await setRegistry(registry);

  return summary;
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  return getRegistry();
}

export async function deleteDocument(id: string) {
  await getIndex().deleteNamespace(id);

  const registry = await getRegistry();
  await setRegistry(registry.filter((doc) => doc.id !== id));
}

export async function hasDocument() {
  const registry = await getRegistry();
  return registry.length > 0;
}
