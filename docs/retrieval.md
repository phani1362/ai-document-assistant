# Retrieval: what we tried and what shipped

All numbers come from the golden set in
[`backend/evals/datasets/golden.jsonl`](../backend/evals/datasets/golden.jsonl):
60 answerable questions over 200 arXiv papers (10,767 searchable chunks). A retrieved
chunk counts as relevant if it contains the question's verbatim evidence quote. Raw
reports are in [`backend/evals/results/`](../backend/evals/results/).

## Results

| Retrieval | Hit@1 | Hit@5 | MRR@10 | p50 latency | Cost / query |
|---|---|---|---|---|---|
| Dense, local `bge-base-en-v1.5` | 0.60 | 0.90 | 0.71 | 0.09 s | $0 |
| Dense, OpenAI `text-embedding-3-small` | 0.73 | 0.93 | 0.83 | 0.25 s | ~$0.000002 |
| Keyword (Postgres full-text) | 0.60 | 0.75 | 0.66 | 0.08 s | $0 |
| Hybrid (dense + keyword, RRF) | 0.70 | 0.92 | 0.79 | 0.38 s | ~$0.000002 |
| Hybrid + `gpt-4.1-nano` reranker | 0.75 | 0.90 | 0.82 | 2.3 s | ~$0.0006 |
| Hybrid + `gpt-4.1-mini` reranker | 0.85 | 0.98 | 0.91 | 2.3 s | ~$0.0024 |
| **Dense + `gpt-4.1-mini` reranker (shipped)** | **0.85** | **1.00** | **0.91** | 2.1 s | ~$0.0024 |

## What we learned

**Embedding model matters most.** Swapping the local model for OpenAI's small embedding
model gave the largest single jump in hit@1 (0.60 → 0.73), with identical chunks.

**Hybrid search did not help here, and we can say why.** Per question, keyword search
beat dense on 9 questions (mostly exact names: `MedRGB` was rank 9 dense, rank 1
keyword) but lost on 19. Equal-weight reciprocal rank fusion let keyword noise (a
question's generic words like "model" or "use") push good dense results down about as
often as it rescued a miss: 7 questions improved, 9 got worse. It also lowered the
recall of the 20-candidate pool the reranker sees (dense 1.00, hybrid 0.98).

**The reranker is the real win, if the model is strong enough.** `gpt-4.1-nano` fixed 9
questions and broke 9. `gpt-4.1-mini`, reading the question and each candidate together,
lifted hit@1 by 12 points and put the evidence in the top 5 for every question.

**Shipped: dense top-20 → `gpt-4.1-mini` rerank → top 5.** It ties or beats the hybrid
variant everywhere with one fewer moving part. Hybrid stays available
(`RETRIEVAL_MODE=hybrid`).

## Caveats

- **The questions favor dense retrieval.** They were written by an LLM from the passages,
  so they paraphrase the source in fluent prose. Real users often type terse,
  keyword-style queries ("ORPHEAS base model"), where keyword search earns its place.
  A test set of real user queries could reverse this decision; the code keeps hybrid one
  setting away.
- **60 questions is small.** One question is 1.7 points; differences under ~5 points
  (hybrid+rerank vs dense+rerank) are ties, not wins.
- **The reranker adds ~2 s and ~$0.0024 per question.** That's acceptable for a
  research assistant; a latency-critical product would use a hosted cross-encoder.

## How each piece works

- **Dense**: cosine similarity over `halfvec(768)` embeddings with an HNSW index;
  `hnsw.iterative_scan` keeps filtered queries from returning fewer than k rows.
- **Keyword**: `plainto_tsquery` stems the question and drops stopwords; its ANDs are
  rewritten to ORs (matching all terms of a full question almost never succeeds), and
  `ts_rank` with length normalization rewards chunks that match more terms. Headings are
  indexed with the text.
- **RRF**: score = Σ 1/(60 + rank) across the lists a chunk appears in. Uses ranks, not
  raw scores, because cosine similarity and `ts_rank` are on unrelated scales.
- **Reranker**: one structured-output call scores all 20 candidates 0-3
  ("states the answer" … "unrelated"); ties keep retrieval order.
  [`rerank.py`](../backend/app/retrieval/rerank.py)
