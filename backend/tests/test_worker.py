from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, update

from app.config import get_settings
from app.db.models import EMBEDDING_DIMENSIONS, Chunk, ChunkLevel, Document, DocumentStatus
from app.db.session import get_sessionmaker
from app.ingestion.chunking import content_hash
from app.ingestion.worker import claim_next, run_worker

pytestmark = pytest.mark.usefixtures("clean_db")

MARKDOWN = "## Intro\n\n" + " ".join(
    f"Sentence {i} explains retrieval-augmented generation." for i in range(200)
)


class FakeEmbedder:
    name = "fake"

    def __init__(self) -> None:
        self.texts: list[str] = []

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        self.texts.extend(texts)
        return [[1.0] + [0.0] * (EMBEDDING_DIMENSIONS - 1) for _ in texts]

    async def embed_query(self, text: str) -> list[float]:
        return (await self.embed_documents([text]))[0]


class FailingEmbedder(FakeEmbedder):
    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        raise RuntimeError("rate limited")


async def _queue(title: str = "RAG Paper", content: str = MARKDOWN) -> Document:
    async with get_sessionmaker()() as session, session.begin():
        document = Document(
            title=title, content=content, content_hash=content_hash(title + content)
        )
        session.add(document)
    return document


async def test_worker_chunks_embeds_and_marks_ready() -> None:
    document = await _queue()
    embedder = FakeEmbedder()

    processed = await run_worker(once=True, embedder=embedder)

    assert processed == 1
    async with get_sessionmaker()() as session:
        stored = await session.get_one(Document, document.id)
        children = list(
            await session.scalars(
                select(Chunk).where(Chunk.document_id == document.id, Chunk.level == "child")
            )
        )
        parent_count = await session.scalar(
            select(func.count()).where(
                Chunk.document_id == document.id, Chunk.level == ChunkLevel.PARENT
            )
        )
    assert stored.status == DocumentStatus.READY
    assert stored.chunk_count == len(children) > 1
    assert stored.embedding_model == "fake"
    assert parent_count and parent_count >= 1
    assert all(child.parent_id and child.embedding is not None for child in children)
    # Each embedded text carries the document title and section as context.
    assert all(text.startswith("RAG Paper > Intro\n\n") for text in embedder.texts)


async def test_worker_retries_then_marks_failed() -> None:
    document = await _queue()

    processed = await run_worker(once=True, embedder=FailingEmbedder())

    assert processed == 0
    async with get_sessionmaker()() as session:
        stored = await session.get_one(Document, document.id)
    assert stored.status == DocumentStatus.FAILED
    assert stored.attempts == get_settings().worker_max_attempts
    assert stored.error == "RuntimeError: rate limited"


async def test_claim_reclaims_stale_processing_documents_only() -> None:
    stale = await _queue(title="stale")
    fresh = await _queue(title="fresh")
    settings = get_settings()
    async with get_sessionmaker()() as session, session.begin():
        await session.execute(
            update(Document)
            .where(Document.id == stale.id)
            .values(
                status=DocumentStatus.PROCESSING,
                updated_at=datetime.now(UTC) - timedelta(hours=1),
            )
        )
        await session.execute(
            update(Document).where(Document.id == fresh.id).values(status=DocumentStatus.PROCESSING)
        )

    async with get_sessionmaker()() as session:
        first = await claim_next(session, settings)
    async with get_sessionmaker()() as session:
        second = await claim_next(session, settings)

    assert first == stale.id
    assert second is None


async def test_documents_endpoint_reports_status_counts(client: AsyncClient) -> None:
    await _queue(title="one")
    await _queue(title="two")
    await run_worker(once=True, embedder=FakeEmbedder())
    await _queue(title="three")

    response = await client.get("/documents")

    body = response.json()
    assert response.status_code == 200
    assert body["total"] == 3
    assert body["status_counts"] == {"ready": 2, "queued": 1}
    assert [item["title"] for item in body["items"]] == ["three", "two", "one"]


async def test_delete_requires_admin_token(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    document = await _queue()
    monkeypatch.setattr(get_settings(), "admin_token", "s3cret")

    anonymous = await client.delete(f"/documents/{document.id}")
    wrong = await client.delete(f"/documents/{document.id}", headers={"X-Admin-Token": "nope"})
    admin = await client.delete(f"/documents/{document.id}", headers={"X-Admin-Token": "s3cret"})

    assert (anonymous.status_code, wrong.status_code, admin.status_code) == (403, 403, 204)
