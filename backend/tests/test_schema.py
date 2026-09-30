import hashlib

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import EMBEDDING_DIMENSIONS, Chunk, ChunkLevel, Document


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _unit_vector(position: int) -> list[float]:
    vector = [0.0] * EMBEDDING_DIMENSIONS
    vector[position] = 1.0
    return vector


async def test_vector_and_keyword_search_over_chunks(session: AsyncSession) -> None:
    document = Document(title="Attention Is All You Need", content_hash=_hash("doc"))
    parent = Chunk(
        document=document,
        level=ChunkLevel.PARENT,
        chunk_index=0,
        section_path="Model Architecture",
        text="The Transformer uses stacked self-attention and feed-forward layers.",
        token_count=12,
        content_hash=_hash("parent"),
    )
    session.add_all([document, parent])
    await session.flush()
    session.add_all(
        [
            Chunk(
                document=document,
                parent_id=parent.id,
                level=ChunkLevel.CHILD,
                chunk_index=index,
                section_path="Model Architecture",
                text=text,
                token_count=8,
                content_hash=_hash(text),
                embedding=_unit_vector(index),
            )
            for index, text in enumerate(
                ["Multi-head attention runs in parallel.", "Positional encodings use sinusoids."]
            )
        ]
    )
    await session.flush()

    nearest = await session.scalar(
        select(Chunk.text)
        .where(Chunk.level == ChunkLevel.CHILD)
        .order_by(Chunk.embedding.cosine_distance(_unit_vector(1)))
        .limit(1)
    )
    assert nearest == "Positional encodings use sinusoids."

    keyword_hits = await session.scalars(
        select(Chunk.text).where(
            Chunk.search_vector.op("@@")(func.websearch_to_tsquery("english", "sinusoidal"))
        )
    )
    assert list(keyword_hits) == ["Positional encodings use sinusoids."]
