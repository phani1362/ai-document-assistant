# Eval: 20261001-0212-hybrid-rerank-retrieval

72 questions (60 answerable, 12 unanswerable). Config: `{"pipeline": "hybrid-rerank", "k": 10, "top_k_context": 5, "embedding": "openai:text-embedding-3-small:768", "llm": null, "chunking": [350, 50, 1200]}`

## Retrieval

| Metric | Value |
|---|---|
| hit@1 | 0.75 |
| hit@5 | 0.9 |
| hit@10 | 0.967 |
| mrr@10 | 0.819 |
| paper_hit@5 | 1.0 |
| p50_seconds | 2.27 |

## LLM usage

| Model | Calls | Input tok | Output tok | Cost USD |
|---|---|---|---|---|
| text-embedding-3-small | 72 | 2628 | 0 | 0.0001 |
| gpt-4.1-nano | 72 | 384836 | 13212 | 0.0438 |

Total cost: $0.0438
