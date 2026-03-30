# AI Document Assistant

A simple local MVP for uploading a `.txt` document, asking questions about it, and seeing the source text used to answer.

## Features

- Upload a single `.txt` file
- Split text into overlapping chunks
- Generate embeddings with OpenAI
- Retrieve the top 3 relevant chunks with cosine similarity
- Answer only from retrieved document context
- Show source chunks in the UI

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- App Router
- OpenAI API
- In-memory server-side document store

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file and add your OpenAI API key:

```bash
cp .env.example .env.local
```

3. Start the dev server:

```bash
npm run dev
```

4. Open `http://localhost:3000`

## How It Works

1. Upload a `.txt` file on the app page.
2. The server reads the text, splits it into chunks, and creates embeddings.
3. When you ask a question, the app embeds the query and compares it with the stored chunk embeddings.
4. The top 3 chunks are passed to the chat model.
5. The model answers only from those chunks and the UI shows the source text.

## Notes

- This MVP stores only one uploaded document in memory.
- Data resets when the server restarts.
- Only `.txt` files are supported.
