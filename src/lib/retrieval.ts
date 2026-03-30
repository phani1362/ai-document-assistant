import { Index } from "@upstash/vector";

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
};

export async function retrieveRelevantChunks(
  queryEmbedding: number[],
  limit = 3,
): Promise<RetrievedChunk[]> {
  const results = await getIndex().query({
    vector: queryEmbedding,
    topK: limit,
    includeMetadata: true,
  });

  return results.map((result) => ({
    id: result.id as string,
    score: result.score,
    text: (result.metadata?.text as string) || "",
    index: (result.metadata?.index as number) || 0,
  }));
}
