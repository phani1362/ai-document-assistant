# Eval: 20261001-0208-baseline-retrieval

72 questions (60 answerable, 12 unanswerable). Config: `{"pipeline": "baseline", "k": 10, "top_k_context": 5, "embedding": "openai:text-embedding-3-small:768", "llm": null, "chunking": [350, 50, 1200]}`

## Retrieval

| Metric | Value |
|---|---|
| hit@1 | 0.733 |
| hit@5 | 0.933 |
| hit@10 | 0.983 |
| mrr@10 | 0.829 |
| paper_hit@5 | 1.0 |
| p50_seconds | 0.25 |

## LLM usage

| Model | Calls | Input tok | Output tok | Cost USD |
|---|---|---|---|---|
| text-embedding-3-small | 72 | 2628 | 0 | 0.0001 |

Total cost: $0.0001
