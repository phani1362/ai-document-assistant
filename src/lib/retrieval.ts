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

/**
 * Retrieve several semantic views of a question and combine their rankings.
 * Reciprocal-rank fusion is deliberately database-agnostic and is more robust
 * than trusting a single rewritten query or raw similarity score.
 */
export async function retrieveWithRankFusion(
  queryEmbeddings: number[][],
  limit = 6,
  documentId?: string,
): Promise<RetrievedChunk[]> {
  const candidateLimit = Math.max(limit * 2, 8);
  const rankings = await Promise.all(
    queryEmbeddings.map((embedding) =>
      retrieveRelevantChunks(embedding, candidateLimit, documentId),
    ),
  );
  const fused = new Map<
    string,
    { chunk: RetrievedChunk; reciprocalRank: number; bestScore: number }
  >();

  for (const ranking of rankings) {
    ranking.forEach((chunk, rank) => {
      const key = `${chunk.documentId}:${chunk.id}`;
      const current = fused.get(key) ?? {
        chunk,
        reciprocalRank: 0,
        bestScore: chunk.score,
      };
      current.reciprocalRank += 1 / (60 + rank + 1);
      current.bestScore = Math.max(current.bestScore, chunk.score);
      fused.set(key, current);
    });
  }

  return [...fused.values()]
    .sort(
      (a, b) =>
        b.reciprocalRank - a.reciprocalRank || b.bestScore - a.bestScore,
    )
    .slice(0, limit)
    .map(({ chunk, bestScore }) => ({ ...chunk, score: bestScore }));
}
