"""Naive RAG: one dense search, parent expansion, one LLM call.

This is the reference point the evaluation compares every later pipeline against.
"""

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.chat import LLM
from app.llm.embeddings import Embedder
from app.retrieval.search import ContextPassage, RetrievedChunk, dense_search, expand_to_parents

ABSTAIN_MESSAGE = "I could not find this in the indexed papers."

SYSTEM_PROMPT = f"""You answer questions about research papers using only the numbered sources.
Rules:
- Use only information stated in the sources. Do not use outside knowledge.
- Cite every factual sentence with the source number in brackets, e.g. [2] or [1][3].
- If the sources do not contain the answer, reply exactly: "{ABSTAIN_MESSAGE}"
- Be concise: answer in at most a short paragraph."""


@dataclass
class RagResult:
    answer: str
    passages: list[ContextPassage]
    retrieved: list[RetrievedChunk]


def format_sources(passages: list[ContextPassage]) -> str:
    return "\n\n".join(
        f"[{number}] {passage.title} — {passage.section_path or 'Body'}\n{passage.text}"
        for number, passage in enumerate(passages, start=1)
    )


async def answer_baseline(
    session: AsyncSession,
    embedder: Embedder,
    llm: LLM,
    question: str,
    *,
    k: int = 5,
    retrieved: list[RetrievedChunk] | None = None,
) -> RagResult:
    """Answer `question`. Pass `retrieved` to reuse a search that was already run."""
    if retrieved is None:
        retrieved = await dense_search(session, embedder, question, k)
    passages = await expand_to_parents(session, retrieved[:k])
    if not passages:
        return RagResult(ABSTAIN_MESSAGE, [], retrieved)
    answer = await llm.generate(
        f"Sources:\n\n{format_sources(passages)}\n\nQuestion: {question}",
        system=SYSTEM_PROMPT,
    )
    return RagResult(answer, passages, retrieved)
