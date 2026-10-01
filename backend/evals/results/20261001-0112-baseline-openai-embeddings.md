# Eval: 20261001-0112-baseline

72 questions (60 answerable, 12 unanswerable). Config: `{"pipeline": "baseline", "k": 10, "top_k_context": 5, "embedding": "openai:text-embedding-3-small:768", "llm": "gpt-4.1-mini", "chunking": [350, 50, 1200]}`

## Retrieval

| Metric | Value |
|---|---|
| hit@1 | 0.733 |
| hit@5 | 0.933 |
| hit@10 | 0.983 |
| mrr@10 | 0.829 |
| paper_hit@5 | 1.0 |
| p50_seconds | 0.27 |

## Answers

| Metric | Value |
|---|---|
| context_recall | 0.933 |
| faithfulness | 0.98 |
| correctness | 0.95 |
| answered_correctly | 0.933 |
| false_abstention | 0.033 |
| abstention_accuracy | 0.5 |
| citations_valid | 1.0 |
| cited_when_answering | 1.0 |
| p50_seconds | 1.42 |
| p95_seconds | 2.0 |

## LLM usage

| Model | Calls | Input tok | Output tok | Cost USD |
|---|---|---|---|---|
| text-embedding-3-small | 72 | 2628 | 0 | 0.0001 |
| gpt-4.1-mini | 144 | 364100 | 17294 | 0.1733 |

Total cost: $0.1734
