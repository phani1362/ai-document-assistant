"""The retrieval configuration the application uses, chosen by evaluation.

On the golden set (60 answerable questions over 200 papers), dense retrieval with an
LLM reranker matched or beat hybrid + reranker on every metric (hit@1 0.85, hit@5 1.00,
MRR 0.91 vs. 0.73 / 0.93 / 0.83 for dense alone). See docs/retrieval.md.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.llm.chat import get_llm
from app.llm.embeddings import Embedder
from app.retrieval.rerank import rerank
from app.retrieval.search import RetrievedChunk, dense_search, hybrid_search


async def retrieve(
    session: AsyncSession, embedder: Embedder, question: str, k: int
) -> list[RetrievedChunk]:
    settings = get_settings()
    pool = settings.rerank_candidates if settings.rerank else k
    if settings.retrieval_mode == "hybrid":
        candidates = await hybrid_search(session, embedder, question, pool)
    else:
        candidates = await dense_search(session, embedder, question, pool)
    if not settings.rerank:
        return candidates[:k]
    return await rerank(get_llm(settings.rerank_llm), question, candidates, k)
