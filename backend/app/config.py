from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, loaded from environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+psycopg://rag:rag@localhost:5432/rag"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    # LLMs. Swappable per provider; "chat" answers and judges, "fast" does cheap agent steps.
    llm_provider: Literal["openai", "gemini"] = "openai"
    openai_api_key: str | None = None
    gemini_api_key: str | None = None
    chat_model: str = "gpt-4.1-mini"
    fast_model: str = "gpt-4.1-nano"
    # Client-side requests-per-minute cap per model (Gemini's free tier needs ~5).
    llm_rpm: int = 60
    # Hard stop for one process (e.g. an eval run) once estimated spend passes this.
    llm_budget_usd: float = 0.50

    # Embeddings. "local" runs an open model on CPU: free and unmetered, which matters
    # for bulk ingestion (Gemini's free tier allows ~100 texts per minute plus a daily cap).
    embedding_provider: Literal["local", "gemini"] = "local"
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
    # HNSW candidates examined per query; higher = better recall, slower.
    hnsw_ef_search: int = 100

    # Ingestion worker.
    worker_poll_seconds: float = 2.0
    worker_max_attempts: int = 3
    worker_stale_after_minutes: int = 15

    # arXiv asks bulk clients to wait 3 seconds between requests.
    arxiv_request_delay_seconds: float = 3.0
    arxiv_cache_dir: str = "data/arxiv"


@lru_cache
def get_settings() -> Settings:
    return Settings()
