"""Retrieval over child chunks, and expansion of hits to their parent sections."""

import uuid
from dataclasses import dataclass, field

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import Chunk, ChunkLevel, Document, DocumentStatus
from app.llm.embeddings import Embedder


@dataclass(frozen=True)
class RetrievedChunk:
    """A searched (child) chunk, ranked by relevance to the query."""

    chunk_id: uuid.UUID
    parent_id: uuid.UUID | None
    document_id: uuid.UUID
    external_id: str | None
    title: str
    section_path: str
    text: str
    score: float


@dataclass
class ContextPassage:
    """A parent section handed to the LLM, with the children that led to it."""

    parent_id: uuid.UUID
    document_id: uuid.UUID
    external_id: str | None
    title: str
    url: str | None
    section_path: str
    text: str
    matched_chunks: list[RetrievedChunk] = field(default_factory=list)


async def dense_search(
    session: AsyncSession, embedder: Embedder, query: str, k: int
) -> list[RetrievedChunk]:
    """Top-k child chunks by cosine similarity, among documents embedded by `embedder`."""
    query_vector = await embedder.embed_query(query)
    # Filtering (ready documents, same embedding model) happens after the HNSW scan;
    # iterative scanning keeps searching until k rows survive the filter.
    await session.execute(text(f"SET LOCAL hnsw.ef_search = {get_settings().hnsw_ef_search:d}"))
    await session.execute(text("SET LOCAL hnsw.iterative_scan = relaxed_order"))
    distance = Chunk.embedding.cosine_distance(query_vector)
    rows = await session.execute(
        select(Chunk, Document.title, Document.external_id, distance.label("distance"))
        .join(Document, Document.id == Chunk.document_id)
        .where(
            Chunk.level == ChunkLevel.CHILD,
            Document.status == DocumentStatus.READY,
            Document.embedding_model == embedder.name,
        )
        .order_by(distance)
        .limit(k)
    )
    return [
        RetrievedChunk(
            chunk_id=chunk.id,
            parent_id=chunk.parent_id,
            document_id=chunk.document_id,
            external_id=external_id,
            title=title,
            section_path=chunk.section_path,
            text=chunk.text,
            score=1.0 - float(chunk_distance),
        )
        for chunk, title, external_id, chunk_distance in rows
    ]


async def expand_to_parents(
    session: AsyncSession, chunks: list[RetrievedChunk]
) -> list[ContextPassage]:
    """Replace child hits with their parent sections, deduplicated, in rank order.

    Several children often come from one section; sending that section once gives the
    LLM more context per token than sending overlapping fragments.
    """
    parent_ids = list(dict.fromkeys(c.parent_id for c in chunks if c.parent_id is not None))
    if not parent_ids:
        return []
    rows = await session.execute(
        select(Chunk, Document.url)
        .join(Document, Document.id == Chunk.document_id)
        .where(Chunk.id.in_(parent_ids))
    )
    parents = {parent.id: (parent, url) for parent, url in rows}
    passages: dict[uuid.UUID, ContextPassage] = {}
    for chunk in chunks:
        if chunk.parent_id is None or chunk.parent_id not in parents:
            continue
        if chunk.parent_id not in passages:
            parent, url = parents[chunk.parent_id]
            passages[chunk.parent_id] = ContextPassage(
                parent_id=parent.id,
                document_id=parent.document_id,
                external_id=chunk.external_id,
                title=chunk.title,
                url=url,
                section_path=parent.section_path,
                text=parent.text,
            )
        passages[chunk.parent_id].matched_chunks.append(chunk)
    return list(passages.values())
