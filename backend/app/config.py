from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, loaded from environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+psycopg://rag:rag@localhost:5432/rag"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    # Required by destructive endpoints (e.g. deleting documents); unset = disabled.
    admin_token: str | None = None

    # LLMs. Swappable per provider; "chat" answers and judges, "fast" does cheap agent steps.
    llm_provider: Literal["openai", "gemini"] = "openai"
    openai_api_key: str | None = None
    gemini_api_key: str | None = None
    chat_model: str = "gpt-4.1-mini"
    fast_model: str = "gpt-4.1-nano"
    # Client-side requests-per-minute cap per model (Gemini's free tier needs ~5).
    llm_rpm: int = 60
    # Hard stop once estimated spend passes this: per process for scripts (e.g. an eval
    # run), per UTC day for the API server.
    llm_budget_usd: float = 0.50
    # Public /chat limits per client IP.
    chat_per_minute: int = 6
    chat_per_day: int = 40

    # Embeddings. "openai" is fast and cheap (~$0.06 for the whole corpus) and keeps the
    # server small enough for free hosting. "local" runs an open model on CPU (free,
    # unmetered, but ~500 MB of RAM; install with `uv sync --extra local`). Gemini's free
    # tier allows ~100 texts per minute plus a daily cap.
    embedding_provider: Literal["openai", "local", "gemini"] = "openai"
    openai_embedding_model: str = "text-embedding-3-small"
    local_embedding_model: str = "BAAI/bge-base-en-v1.5"
    gemini_embedding_model: str = "gemini-embedding-001"
    model_cache_dir: str = "data/models"
    # 768 dims stored as halfvec keeps ~30k chunks well inside free Postgres tiers.
    embedding_dimensions: int = 768
    embedding_batch_size: int = 16

    # Chunking, in tokens. Children are embedded and searched; parents give the LLM context.
    child_chunk_tokens: int = 350
    child_overlap_tokens: int = 50
    parent_chunk_tokens: int = 1200

    # Retrieval.
    retrieval_top_k: int = 5
    # Defaults chosen by evaluation; see docs/retrieval.md.
    retrieval_mode: Literal["dense", "hybrid"] = "dense"
    rerank: bool = True
    # gpt-4.1-nano reranked no better than no reranker; gpt-4.1-mini lifted hit@1 0.73 -> 0.85.
    rerank_llm: Literal["chat", "fast"] = "chat"
    rerank_candidates: int = 20
    # HNSW candidates examined per query; higher = better recall, slower.
    hnsw_ef_search: int = 100

    # Ingestion worker.
    worker_poll_seconds: float = 2.0
    worker_max_attempts: int = 3
    worker_stale_after_minutes: int = 15

    # arXiv asks bulk clients to wait 3 seconds between requests.
    arxiv_request_delay_seconds: float = 3.0
    arxiv_cache_dir: str = "data/arxiv"

    @field_validator(
        "openai_api_key", "gemini_api_key", "admin_token", "database_url", mode="before"
    )
    @classmethod
    def _strip_secret(cls, value: object) -> object:
        # Secrets pasted into dashboards often carry a trailing newline or quotes; a
        # newline in an Authorization header makes every API call fail as a
        # "connection error", which is very hard to diagnose.
        return value.strip().strip("\"'") if isinstance(value, str) else value


@lru_cache
def get_settings() -> Settings:
    return Settings()
