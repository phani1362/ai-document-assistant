# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (runs on port 3001, uses --webpack flag)
npm run build      # Production build (also uses --webpack)
npm run lint       # ESLint via eslint-config-next (core-web-vitals + typescript)
npm run typecheck  # tsc --noEmit (strict mode)
```

There is no test suite configured. Type checking and linting are the primary correctness tools.

## Environment Setup

Copy `.env.example` to `.env.local` and populate all six variables before running:

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Required for embeddings and chat completions |
| `UPSTASH_VECTOR_REST_URL` | Upstash Vector index endpoint |
| `UPSTASH_VECTOR_REST_TOKEN` | Upstash Vector auth token |
| `APP_PASSWORD` | Plain-text password users enter at `/login` |
| `OPENAI_CHAT_MODEL` | Defaults to `gpt-4.1-mini` if unset |
| `OPENAI_EMBEDDING_MODEL` | Defaults to `text-embedding-3-small` if unset |

## Architecture

This is a Next.js 16 App Router application implementing a RAG (Retrieval-Augmented Generation) pipeline for document Q&A.

### RAG Pipeline

**Upload flow** (`POST /api/upload`):
1. Parse file content — `.txt` (native), `.pdf` (pdf-parse), `.docx` (mammoth)
2. `chunkText()` splits text into ~800-char chunks with 120-char overlap, snapping to newline boundaries
3. `createEmbeddings()` batches all chunk texts to OpenAI embeddings API
4. `saveDocument()` resets the Upstash Vector index, then upserts all chunk vectors in batches of 100

**Query flow** (`POST /api/chat`):
1. `createQueryEmbedding()` embeds the user's question
2. `retrieveRelevantChunks()` queries Upstash Vector for top-3 nearest neighbors
3. Retrieved chunks are assembled into a context string and sent to the chat model with a strict grounding system prompt

### Storage

Despite the README describing "in-memory" storage, the actual implementation uses **Upstash Vector** as a persistent vector store. Only one document exists at a time — uploading a new document calls `index.reset()` first. Chunk metadata (text, fileName, index) is stored alongside the vectors in Upstash.

### Authentication

`src/proxy.ts` is the route middleware (not named `middleware.ts` — it exports `proxy` and a `matcher` config). It protects `/app/*` by checking an `auth-token` cookie whose value must equal `SHA-256(APP_PASSWORD)`. The `/api/auth` route handles login (POST), session check (GET), and logout (DELETE).

### Key Lib Files

- `src/lib/openai.ts` — singleton OpenAI client (lazy-init, throws if `OPENAI_API_KEY` missing)
- `src/lib/chunk.ts` — pure `chunkText()` function; no external dependencies
- `src/lib/embeddings.ts` — wraps OpenAI embeddings and chat completions APIs
- `src/lib/retrieval.ts` — wraps Upstash Vector `query()` for nearest-neighbor lookup
- `src/lib/store.ts` — wraps Upstash Vector `reset()` and `upsert()` for document ingestion

Both `src/lib/store.ts` and `src/lib/retrieval.ts` instantiate `new Index(...)` on every call (not cached), so Upstash credentials are read from `process.env` at call time.

### Path Alias

`@/*` resolves to `./src/*` (configured in `tsconfig.json`).

### Server-Only Packages

`next.config.ts` marks `pdf-parse` and `mammoth` as `serverExternalPackages`. These must remain server-side only and must never be imported from client components.
