import asyncio
import logging
import math
from functools import lru_cache
from typing import Protocol, cast

import openai
from google import genai
from google.genai import errors, types
from tenacity import (
    AsyncRetrying,
    before_sleep_log,
    retry_if_exception,
    stop_after_attempt,
    wait_random_exponential,
)

from app.config import get_settings
from app.llm.chat import is_retryable_llm_error, usage_tracker

logger = logging.getLogger(__name__)


class Embedder(Protocol):
    # Recorded on each document so vectors from different models are never compared.
    name: str

    async def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    async def embed_query(self, text: str) -> list[float]: ...


def _is_retryable(error: BaseException) -> bool:
    # 429 = rate limited (common on the free tier); 5xx = transient server trouble.
    return isinstance(error, errors.APIError) and (error.code == 429 or error.code >= 500)


def _normalize(vector: list[float]) -> list[float]:
    # Gemini only normalizes full 3072-dim output; truncated vectors must be
    # re-normalized for cosine distances to be comparable.
    norm = math.sqrt(sum(value * value for value in vector)) or 1.0
    return [value / norm for value in vector]


class LocalEmbedder:
    """Open-source embedding model run in-process with ONNX Runtime (no GPU, no API)."""

    def __init__(self, model: str, cache_dir: str, batch_size: int) -> None:
        # Imported lazily: loading the model takes seconds and ~500 MB of RAM.
        from fastembed import TextEmbedding

        self.name = f"local:{model}"
        self._model = TextEmbedding(model, cache_dir=cache_dir)
        self._batch_size = batch_size

    def _embed_passages(self, texts: list[str]) -> list[list[float]]:
        return [v.tolist() for v in self._model.passage_embed(texts, batch_size=self._batch_size)]

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        # Inference is CPU-bound; run it off the event loop.
        return await asyncio.to_thread(self._embed_passages, texts)

    async def embed_query(self, text: str) -> list[float]:
        # query_embed adds the instruction prefix BGE models expect for search queries.
        [vector] = await asyncio.to_thread(lambda: list(self._model.query_embed([text])))
        return [float(value) for value in vector]


class OpenAIEmbedder:
    """OpenAI embeddings, shortened to `dimensions` (the API returns them normalized)."""

    def __init__(
        self, client: openai.AsyncOpenAI, model: str, dimensions: int, batch_size: int
    ) -> None:
        self.name = f"openai:{model}:{dimensions}"
        self._client = client
        self._model = model
        self._dimensions = dimensions
        self._batch_size = batch_size

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for start in range(0, len(texts), self._batch_size):
            batch = texts[start : start + self._batch_size]
            async for attempt in AsyncRetrying(
                retry=retry_if_exception(is_retryable_llm_error),
                wait=wait_random_exponential(multiplier=2, max=60),
                stop=stop_after_attempt(6),
                before_sleep=before_sleep_log(logger, logging.WARNING),
                reraise=True,
            ):
                with attempt:
                    response = await self._client.embeddings.create(
                        model=self._model, input=batch, dimensions=self._dimensions
                    )
            usage_tracker.record(self._model, response.usage.prompt_tokens, 0)
            vectors.extend(item.embedding for item in sorted(response.data, key=lambda d: d.index))
        return vectors

    async def embed_query(self, text: str) -> list[float]:
        [vector] = await self.embed_documents([text])
        return vector


class GeminiEmbedder:
    def __init__(self, client: genai.Client, model: str, dimensions: int, batch_size: int) -> None:
        self.name = f"gemini:{model}:{dimensions}"
        self._client = client
        self._model = model
        self._dimensions = dimensions
        self._batch_size = batch_size

    async def _embed(self, texts: list[str], task_type: str) -> list[list[float]]:
        vectors: list[list[float]] = []
        config = types.EmbedContentConfig(
            task_type=task_type, output_dimensionality=self._dimensions
        )
        for start in range(0, len(texts), self._batch_size):
            batch = texts[start : start + self._batch_size]
            async for attempt in AsyncRetrying(
                retry=retry_if_exception(_is_retryable),
                wait=wait_random_exponential(multiplier=2, max=90),
                stop=stop_after_attempt(8),
                before_sleep=before_sleep_log(logger, logging.WARNING),
                reraise=True,
            ):
                with attempt:
                    response = await self._client.aio.models.embed_content(
                        model=self._model,
                        contents=cast(types.ContentListUnion, batch),
                        config=config,
                    )
            embeddings = response.embeddings or []
            if len(embeddings) != len(batch):
                raise RuntimeError(f"Expected {len(batch)} embeddings, got {len(embeddings)}")
            vectors.extend(_normalize(list(item.values or [])) for item in embeddings)
        return vectors

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return await self._embed(texts, "RETRIEVAL_DOCUMENT")

    async def embed_query(self, text: str) -> list[float]:
        [vector] = await self._embed([text], "RETRIEVAL_QUERY")
        return vector


@lru_cache
def get_embedder() -> Embedder:
    settings = get_settings()
    if settings.embedding_provider == "openai":
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set. Add it to backend/.env.")
        return OpenAIEmbedder(
            client=openai.AsyncOpenAI(api_key=settings.openai_api_key, max_retries=0),
            model=settings.openai_embedding_model,
            dimensions=settings.embedding_dimensions,
            batch_size=256,
        )
    if settings.embedding_provider == "local":
        return LocalEmbedder(
            model=settings.local_embedding_model,
            cache_dir=settings.model_cache_dir,
            batch_size=settings.embedding_batch_size,
        )
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set. Add it to backend/.env.")
    return GeminiEmbedder(
        client=genai.Client(api_key=settings.gemini_api_key),
        model=settings.gemini_embedding_model,
        dimensions=settings.embedding_dimensions,
        batch_size=100,
    )
