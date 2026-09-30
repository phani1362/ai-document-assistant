from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, loaded from environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+psycopg://rag:rag@localhost:5432/rag"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    # Models. Gemini is the default because it has a free tier; every model is swappable.
    gemini_api_key: str | None = None
    chat_model: str = "gemini-2.5-flash"
    fast_model: str = "gemini-2.5-flash-lite"
    embedding_model: str = "gemini-embedding-001"
    # 768 dims stored as halfvec keeps ~30k chunks well inside free Postgres tiers.
    embedding_dimensions: int = 768


@lru_cache
def get_settings() -> Settings:
    return Settings()
