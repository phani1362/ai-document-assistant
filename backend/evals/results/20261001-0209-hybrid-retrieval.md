# Eval: 20261001-0209-hybrid-retrieval

72 questions (60 answerable, 12 unanswerable). Config: `{"pipeline": "hybrid", "k": 10, "top_k_context": 5, "embedding": "openai:text-embedding-3-small:768", "llm": null, "chunking": [350, 50, 1200]}`

## Retrieval

| Metric | Value |
|---|---|
| hit@1 | 0.7 |
| hit@5 | 0.917 |
| hit@10 | 0.95 |
| mrr@10 | 0.789 |
| paper_hit@5 | 1.0 |
| p50_seconds | 0.38 |

## LLM usage

| Model | Calls | Input tok | Output tok | Cost USD |
|---|---|---|---|---|
| text-embedding-3-small | 72 | 2628 | 0 | 0.0001 |

Total cost: $0.0001
