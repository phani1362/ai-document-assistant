"""LLM reranking: re-score retrieved candidates against the question, read together.

First-stage retrieval scores each chunk independently from compressed representations
(one vector, or term counts). A reranker reads the question and each passage in full,
so it can tell "mentions the method" apart from "states the requested number".
A cross-encoder model would do the same job, but needs ~1 GB of RAM; one small-LLM
call over 20 short passages costs about $0.0007 and fits a 512 MB server.
"""

from dataclasses import replace

from pydantic import BaseModel, Field

from app.llm.chat import LLM
from app.retrieval.search import RetrievedChunk


class PassageScore(BaseModel):
    passage: int = Field(description="Passage number as given")
    score: int = Field(description="0-3 relevance")


class RerankResult(BaseModel):
    scores: list[PassageScore]


RERANK_SYSTEM = """You rank search results for a question about research papers.
Score EVERY passage for how useful it is for answering the question:
3 = states the answer (the specific fact, number, or explanation asked for)
2 = clearly about the asked-for thing but doesn't state the answer
1 = same general topic only
0 = unrelated, or about a different method/paper than the one the question names
Judge only from the passage text. Return one score per passage."""


def _format(candidates: list[RetrievedChunk]) -> str:
    return "\n\n".join(
        f"[{number}] {chunk.title} — {chunk.section_path or 'Body'}\n{chunk.text}"
        for number, chunk in enumerate(candidates, start=1)
    )


async def rerank(
    llm: LLM, question: str, candidates: list[RetrievedChunk], top_n: int
) -> list[RetrievedChunk]:
    """Reorder candidates by LLM relevance score; ties keep their retrieval order."""
    if not candidates:
        return []
    result = await llm.generate(
        f"Question: {question}\n\nPassages:\n\n{_format(candidates)}",
        system=RERANK_SYSTEM,
        schema=RerankResult,
    )
    scores = {
        item.passage: min(3, max(0, item.score))
        for item in result.scores
        if 1 <= item.passage <= len(candidates)
    }
    ranked = sorted(
        enumerate(candidates, start=1),
        # Unscored passages (the model skipped them) fall back to "same topic".
        key=lambda pair: (-scores.get(pair[0], 1), pair[0]),
    )
    return [replace(chunk, score=float(scores.get(number, 1))) for number, chunk in ranked][:top_n]
