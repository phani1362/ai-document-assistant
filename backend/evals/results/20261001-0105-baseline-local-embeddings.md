# Eval: 20261001-0105-baseline

72 questions (60 answerable, 12 unanswerable). Config: `{"pipeline": "baseline", "k": 10, "top_k_context": 5, "embedding": "local:BAAI/bge-base-en-v1.5", "llm": "gpt-4.1-mini", "chunking": [350, 50, 1200]}`

## Retrieval

| Metric | Value |
|---|---|
| hit@1 | 0.6 |
| hit@5 | 0.9 |
| hit@10 | 0.933 |
| mrr@10 | 0.712 |
| paper_hit@5 | 1.0 |
| p50_seconds | 0.09 |

## Answers

| Metric | Value |
|---|---|
| context_recall | 0.917 |
| faithfulness | 1.0 |
| correctness | 0.954 |
| answered_correctly | 0.95 |
| false_abstention | 0.017 |
| abstention_accuracy | 0.583 |
| citations_valid | 1.0 |
| cited_when_answering | 1.0 |
| p50_seconds | 1.34 |
| p95_seconds | 2.64 |

## LLM usage

| Model | Calls | Input tok | Output tok | Cost USD |
|---|---|---|---|---|
| gpt-4.1-mini | 144 | 373138 | 17776 | 0.1777 |

Total cost: $0.1777
