"""Wires the agent graph to the real database, retrieval pipeline, and LLMs."""

from functools import lru_cache
from typing import Any

from langgraph.graph.state import CompiledStateGraph

from app.agents.graph import AgentDeps, build_graph
from app.config import get_settings
from app.db.session import get_sessionmaker
from app.llm.chat import get_llm
from app.llm.embeddings import get_embedder
from app.retrieval.pipeline import retrieve
from app.retrieval.search import ContextPassage, RetrievedChunk, expand_to_parents


@lru_cache
def get_agent_graph() -> CompiledStateGraph[Any, Any, Any, Any]:
    settings = get_settings()
    embedder = get_embedder()
    sessionmaker = get_sessionmaker()

    # Each call opens its own session: parallel retrievals cannot share one connection.
    async def retrieve_chunks(query: str, k: int) -> list[RetrievedChunk]:
        async with sessionmaker() as session:
            return await retrieve(session, embedder, query, k)

    async def load_passages(chunks: list[RetrievedChunk]) -> list[ContextPassage]:
        async with sessionmaker() as session:
            return await expand_to_parents(session, chunks)

    return build_graph(
        AgentDeps(
            chat_llm=get_llm("chat"),
            fast_llm=get_llm("fast"),
            retrieve=retrieve_chunks,
            load_passages=load_passages,
            top_k=settings.retrieval_top_k,
        )
    )
