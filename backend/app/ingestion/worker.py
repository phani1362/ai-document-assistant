"""Background ingestion worker: claims queued documents, chunks, embeds, and stores them.

Postgres is the job queue. `SELECT ... FOR UPDATE SKIP LOCKED` lets any number of
worker processes run side by side without claiming the same document twice, and a
document left in `processing` by a crashed worker is reclaimed once it goes stale.
"""

import argparse
import asyncio
import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings, get_settings
from app.db.models import Chunk, ChunkLevel, Document, DocumentStatus
from app.db.session import get_sessionmaker
from app.ingestion.chunking import chunk_markdown, embedding_input
from app.llm.embeddings import Embedder, get_embedder

logger = logging.getLogger(__name__)


async def claim_next(session: AsyncSession, settings: Settings) -> uuid.UUID | None:
    stale_before = datetime.now(UTC) - timedelta(minutes=settings.worker_stale_after_minutes)
    document = await session.scalar(
        select(Document)
        .where(
            or_(
                Document.status == DocumentStatus.QUEUED,
                and_(
                    Document.status == DocumentStatus.PROCESSING,
                    Document.updated_at < stale_before,
                ),
            )
        )
        .order_by(Document.created_at)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    if document is None:
        return None
    document.status = DocumentStatus.PROCESSING
    document.attempts += 1
    await session.commit()
    return document.id


async def process_document(
    sessionmaker: async_sessionmaker[AsyncSession],
    document_id: uuid.UUID,
    embedder: Embedder,
    settings: Settings,
) -> None:
    async with sessionmaker() as session:
        document = await session.get_one(Document, document_id)
        title, content = document.title, document.content or ""

    # Chunk and embed outside any transaction: embedding is slow network I/O and
    # must not hold a database connection or row lock while it runs.
    parents = chunk_markdown(
        content,
        child_tokens=settings.child_chunk_tokens,
        child_overlap=settings.child_overlap_tokens,
        parent_tokens=settings.parent_chunk_tokens,
    )
    children = [(parent, child) for parent in parents for child in parent.children]
    if not children:
        raise ValueError("Document produced no chunks; it may be empty or unparseable.")
    vectors = await embedder.embed_documents(
        [embedding_input(title, child.section_path, child.text) for _, child in children]
    )

    async with sessionmaker() as session, session.begin():
        # Replace any chunks from an earlier, partially failed attempt.
        await session.execute(delete(Chunk).where(Chunk.document_id == document_id))
        parent_ids = {parent.index: uuid.uuid4() for parent in parents}
        session.add_all(
            Chunk(
                id=parent_ids[parent.index],
                document_id=document_id,
                level=ChunkLevel.PARENT,
                chunk_index=parent.index,
                section_path=parent.section_path,
                text=parent.text,
                token_count=parent.token_count,
                content_hash=parent.content_hash,
            )
            for parent in parents
        )
        await session.flush()
        session.add_all(
            Chunk(
                document_id=document_id,
                parent_id=parent_ids[parent.index],
                level=ChunkLevel.CHILD,
                chunk_index=child.index,
                section_path=child.section_path,
                text=child.text,
                token_count=child.token_count,
                content_hash=child.content_hash,
                embedding=vector,
            )
            for (parent, child), vector in zip(children, vectors, strict=True)
        )
        document = await session.get_one(Document, document_id)
        document.status = DocumentStatus.READY
        document.chunk_count = len(children)
        document.embedding_model = embedder.name
        document.error = None


async def _record_failure(
    sessionmaker: async_sessionmaker[AsyncSession],
    document_id: uuid.UUID,
    error: Exception,
    settings: Settings,
) -> None:
    async with sessionmaker() as session, session.begin():
        document = await session.get_one(Document, document_id)
        retry = document.attempts < settings.worker_max_attempts
        document.status = DocumentStatus.QUEUED if retry else DocumentStatus.FAILED
        document.error = f"{type(error).__name__}: {error}"[:2000]
    logger.warning(
        "Document %s failed (attempt %s, %s): %s",
        document_id,
        document.attempts,
        "will retry" if retry else "giving up",
        error,
    )


async def run_worker(
    *,
    once: bool = False,
    embedder: Embedder | None = None,
    sessionmaker: async_sessionmaker[AsyncSession] | None = None,
    settings: Settings | None = None,
) -> int:
    """Process documents until the queue is empty (`once`) or forever. Returns # processed."""
    settings = settings or get_settings()
    sessionmaker = sessionmaker or get_sessionmaker()
    embedder = embedder or get_embedder()
    processed = 0

    while True:
        async with sessionmaker() as session:
            document_id = await claim_next(session, settings)
        if document_id is None:
            if once:
                return processed
            await asyncio.sleep(settings.worker_poll_seconds)
            continue
        try:
            await process_document(sessionmaker, document_id, embedder, settings)
            processed += 1
            logger.info("Ingested document %s", document_id)
        except Exception as error:
            await _record_failure(sessionmaker, document_id, error, settings)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the document ingestion worker.")
    parser.add_argument("--once", action="store_true", help="Exit when the queue is empty.")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    processed = asyncio.run(run_worker(once=args.once))
    logger.info("Worker finished; processed %s documents", processed)


if __name__ == "__main__":
    main()
