---
title: Research Paper RAG API
emoji: 📚
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 8000
pinned: false
short_description: Multi-agent RAG API over arXiv papers (FastAPI + pgvector)
---

Backend API for a multi-agent retrieval-augmented generation system over ~200 arXiv
papers. Source code: https://github.com/phani1362/ai-document-assistant

- `GET /health` — service and database status
- `GET /documents` — indexed papers and ingestion status
- `GET /docs` — interactive API documentation
