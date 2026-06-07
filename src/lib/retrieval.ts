import { Index } from "@upstash/vector";
import { listDocuments } from "@/lib/store";

// Helper to get index lazily so Next.js build doesn't crash if env vars are misconfigured
function getIndex() {
  return new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL!,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
  });
}

export type RetrievedChunk = {
  id: string;
  score: number;
  text: string;
  index: number;
  documentId: string;
  fileName: string;
  page?: number;
};

async function queryNamespace(
  documentId: string,
  queryEmbedding: number[],
  limit: number,
): Promise<RetrievedChunk[]> {
  const results = await getIndex().namespace(documentId).query({
    vector: queryEmbedding,
    topK: limit,
    includeMetadata: true,
  });

  return results.map((result) => ({
    id: result.id as string,
    score: result.score,
    text: (result.metadata?.text as string) || "",
    index: (result.metadata?.index as number) || 0,
    documentId,
    fileName: (result.metadata?.fileName as string) || "",
    page: result.metadata?.page as number | undefined,
  }));
}

export async function retrieveRelevantChunks(
  queryEmbedding: number[],
  limit = 3,
  documentId?: string,
): Promise<RetrievedChunk[]> {
  if (documentId) {
    return queryNamespace(documentId, queryEmbedding, limit);
  }

  // No document selected: search across every uploaded document and merge by score
  const documents = await listDocuments();
  const resultsPerDocument = await Promise.all(
    documents.map((doc) => queryNamespace(doc.id, queryEmbedding, limit)),
  );

  return resultsPerDocument
    .flat()
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
