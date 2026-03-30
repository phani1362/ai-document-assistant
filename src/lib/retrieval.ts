import { Index } from "@upstash/vector";

const index = new Index();

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
  const results = await index.query({
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
