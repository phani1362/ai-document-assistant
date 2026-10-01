# Eval: 20261001-0216-hybrid-rerank-retrieval

72 questions (60 answerable, 12 unanswerable). Config: `{"pipeline": "hybrid-rerank", "k": 10, "top_k_context": 5, "rerank_llm": "gpt-4.1-mini", "embedding": "openai:text-embedding-3-small:768", "llm": null, "chunking": [350, 50, 1200]}`

## Retrieval

| Metric | Value |
|---|---|
| hit@1 | 0.85 |
| hit@5 | 0.983 |
| hit@10 | 0.983 |
| mrr@10 | 0.906 |
| paper_hit@5 | 1.0 |
| p50_seconds | 2.31 |

## LLM usage

| Model | Calls | Input tok | Output tok | Cost USD |
|---|---|---|---|---|
| text-embedding-3-small | 72 | 2628 | 0 | 0.0001 |
| gpt-4.1-mini | 72 | 384880 | 13320 | 0.1753 |

Total cost: $0.1753
