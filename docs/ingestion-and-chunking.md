# Ingestion and chunking

How papers get from arXiv into searchable chunks, and why each step works the way it does.

```
arXiv API ──► HTML (LaTeXML) ──► Markdown ──► queue (documents.status = queued)
                                                    │
                          ingestion worker(s) ◄─────┘  SELECT … FOR UPDATE SKIP LOCKED
                                  │
             section-aware parent/child chunking ──► embed children ──► Postgres + pgvector
```

## Source format: HTML, not PDF

arXiv publishes an HTML rendering of most papers submitted since late 2023. HTML keeps the
heading hierarchy, tables and LaTeX math; PDF text extraction loses headings and garbles
tables and multi-column layouts. Papers without HTML are skipped rather than ingested badly.

The parser ([parsers.py](../backend/app/ingestion/parsers.py)) converts HTML to Markdown:

| Kept | Dropped |
|---|---|
| Section headings (`##`–`#####`), numbered as in the paper | Bibliography |
| Paragraphs, lists, figure and table captions | Author blocks, footnotes, navigation |
| Tables, as Markdown tables | Images |
| Math, as LaTeX (`$k_{1}=1.2$`) | |

Markdown is the single format the chunker understands, so future sources (uploads, other
sites) need only a parser, not a new chunker.

## Chunking: section-aware, parent/child

[chunking.py](../backend/app/ingestion/chunking.py)

| | Size | Purpose |
|---|---|---|
| **Child** | ≤ 350 tokens, 50-token overlap | Embedded and searched. Small chunks give precise matches. |
| **Parent** | ≤ 1,200 tokens (a section or part of one) | Handed to the LLM. Enough surrounding context to answer well. |

- **Sections are never mixed.** A chunk only contains text from one heading path, e.g.
  `III Retrieval > III-B Indexing Optimization > III-B 1 Chunking Strategy`.
- **Split fallback: paragraph → sentence → token window.** Text is only cut mid-sentence
  when a single sentence is longer than a chunk.
- **Overlap carries whole sentences**, so a fact at a chunk boundary appears intact in one
  of the two chunks.
- **Tables are split by rows with the header repeated**, so every piece is self-describing.
- **Duplicates are dropped** (content hash per chunk; per document to skip re-ingestion).
- **Contextual embedding input.** Each child is embedded as
  `"{paper title} > {section path}\n\n{text}"`. A chunk like "We set k=5." is meaningless
  alone; with its title and section it can match "what k does paper X use?". The stored
  text stays clean.
- **Keyword index includes the heading path** (`tsvector` over `section_path || text`), so
  a query mentioning "ablation" finds chunks under an *Ablation* heading.

On a sample of 5 papers: 243 children (mean 194 tokens, max 348) under 171 parents.

## The queue: Postgres, not Redis/Celery

Documents carry a `status` (`queued → processing → ready | failed`). Workers claim one
document at a time:

```sql
SELECT … FROM documents
WHERE status = 'queued' OR (status = 'processing' AND updated_at < now() - interval '15 min')
ORDER BY created_at LIMIT 1
FOR UPDATE SKIP LOCKED
```

- **`SKIP LOCKED`** lets any number of workers run in parallel without claiming the same
  document, with no extra infrastructure.
- **Crash recovery:** a document stuck in `processing` (worker died) is reclaimed once stale.
- **Retries:** failures go back to `queued` until `worker_max_attempts`, then `failed` with
  the error recorded.
- **No transaction is held during embedding.** The claim commits immediately; chunks are
  written in one short transaction at the end, replacing any partial earlier attempt.
- A partial index on pending statuses keeps the claim query fast as `ready` rows grow.

## Embeddings: local by default

| | Local (`BAAI/bge-base-en-v1.5`, ONNX) | Gemini `gemini-embedding-001` |
|---|---|---|
| Cost | Free | Free tier |
| Limits | None (CPU bound) | ~100 texts/minute plus a daily cap |
| Dimensions | 768 | 768 (truncated, re-normalized) |

Bulk ingestion hit Gemini's free-tier limit within the first minute, so ingestion defaults
to a local model (`EMBEDDING_PROVIDER=local`). Both implement the same `Embedder` protocol.
Each document records `embedding_model`, so vectors from different models are never
compared at query time. That is a silent, common RAG bug.

Vectors are stored as `halfvec(768)` (16-bit floats) with an HNSW index: half the storage
of `vector(768)` with negligible recall loss, which keeps the corpus inside free Postgres
tiers.

## Running it

```bash
docker compose up -d db
cd backend
uv run alembic upgrade head
uv run python -m app.ingestion.arxiv --max-papers 200   # queue papers (3 s between requests)
uv run python -m app.ingestion.worker                   # chunk + embed; run several for parallelism
curl localhost:8000/documents                           # status counts
```
