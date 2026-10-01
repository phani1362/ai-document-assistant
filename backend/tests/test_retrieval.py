import hashlib
import uuid

import pytest
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Chunk, ChunkLevel, Document, DocumentStatus
from app.llm.chat import LLM
from app.retrieval.rerank import rerank
from app.retrieval.search import RetrievedChunk, keyword_search, reciprocal_rank_fusion


def _chunk(name: str, score: float = 0.0) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=uuid.uuid5(uuid.NAMESPACE_OID, name),
        parent_id=None,
        document_id=uuid.uuid4(),
        external_id=None,
        title=name,
        section_path="",
        text=f"text of {name}",
        score=score,
    )


def test_rrf_rewards_chunks_found_by_both_retrievers() -> None:
    a, b, c, d = (_chunk(n) for n in "abcd")

    fused = reciprocal_rank_fusion([[a, b, c], [d, c, a]])

    # a: 1/61 + 1/63; c: 1/63 + 1/62; b and d appear once.
    assert [chunk.title for chunk in fused] == ["a", "c", "d", "b"]
    assert fused[0].score == pytest.approx(1 / 61 + 1 / 63)


async def test_keyword_search_matches_any_term_and_ranks_more_matches_higher(
    session: AsyncSession,
) -> None:
    document = Document(title="Paper", status=DocumentStatus.READY, content_hash=uuid.uuid4().hex)
    session.add(document)
    texts = {
        "both": "ORPHEAS fine-tunes Multilingual-E5 for Greek retrieval.",
        "one": "Greek is a morphologically rich language.",
        "none": "Transformers rely on self-attention.",
    }
    for index, (name, text) in enumerate(texts.items()):
        session.add(
            Chunk(
                document=document,
                level=ChunkLevel.CHILD,
                chunk_index=index,
                section_path=name,
                text=text,
                token_count=10,
                content_hash=hashlib.sha256(text.encode()).hexdigest(),
            )
        )
    await session.flush()

    hits = await keyword_search(session, "Which base model does ORPHEAS use for Greek?", 10)

    assert [hit.section_path for hit in hits] == ["both", "one"]


class _FakeLLM(LLM):
    def __init__(self, response: str) -> None:
        super().__init__("fake", rpm=10_000)
        self._response = response

    async def _call(
        self, prompt: str, system: str, schema: type[BaseModel] | None
    ) -> tuple[str, int, int]:
        return self._response, 0, 0


async def test_rerank_orders_by_score_and_keeps_retrieval_order_for_ties() -> None:
    candidates = [_chunk(n) for n in "abcd"]
    # c is the answer; a and d tie; b is irrelevant; out-of-range ids are ignored.
    llm = _FakeLLM(
        '{"scores": [{"passage": 1, "score": 2}, {"passage": 2, "score": 0},'
        ' {"passage": 3, "score": 3}, {"passage": 4, "score": 2}, {"passage": 9, "score": 3}]}'
    )

    ranked = await rerank(llm, "question?", candidates, top_n=3)

    assert [chunk.title for chunk in ranked] == ["c", "a", "d"]
    assert ranked[0].score == 3.0
