# Eval: 20261001-0209-keyword-retrieval

72 questions (60 answerable, 12 unanswerable). Config: `{"pipeline": "keyword", "k": 10, "top_k_context": 5, "embedding": "openai:text-embedding-3-small:768", "llm": null, "chunking": [350, 50, 1200]}`

## Retrieval

| Metric | Value |
|---|---|
| hit@1 | 0.6 |
| hit@5 | 0.75 |
| hit@10 | 0.817 |
| mrr@10 | 0.658 |
| paper_hit@5 | 0.983 |
| p50_seconds | 0.08 |
