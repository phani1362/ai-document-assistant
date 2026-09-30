import asyncio
import logging
import time
from functools import lru_cache
from typing import Literal, overload

from google import genai
from google.genai import errors, types
from pydantic import BaseModel, ValidationError
from tenacity import (
    AsyncRetrying,
    before_sleep_log,
    retry_if_exception,
    stop_after_attempt,
    wait_random_exponential,
)

from app.config import get_settings

logger = logging.getLogger(__name__)


def _is_retryable(error: BaseException) -> bool:
    if isinstance(error, errors.APIError):
        return error.code == 429 or error.code >= 500
    # Structured output that fails validation is usually a one-off; ask again.
    return isinstance(error, ValidationError)


class _RateLimiter:
    """Spaces calls to stay under a requests-per-minute quota (free tiers are ~10-15 RPM)."""

    def __init__(self, rpm: int) -> None:
        self._interval = 60.0 / rpm
        self._next = 0.0
        self._lock = asyncio.Lock()

    async def wait(self) -> None:
        async with self._lock:
            delay = self._next - time.monotonic()
            if delay > 0:
                await asyncio.sleep(delay)
            self._next = max(time.monotonic(), self._next) + self._interval


class LLM:
    def __init__(self, client: genai.Client, model: str, rpm: int) -> None:
        self.model = model
        self._client = client
        self._limiter = _RateLimiter(rpm)

    @overload
    async def generate(self, prompt: str, *, system: str = ..., schema: None = None) -> str: ...

    @overload
    async def generate[T: BaseModel](
        self, prompt: str, *, system: str = ..., schema: type[T]
    ) -> T: ...

    async def generate[T: BaseModel](
        self, prompt: str, *, system: str = "", schema: type[T] | None = None
    ) -> str | T:
        """Generate text, or an instance of `schema` when one is given (JSON mode)."""
        config = types.GenerateContentConfig(
            system_instruction=system or None,
            temperature=0,
            response_mime_type="application/json" if schema else None,
            response_schema=schema,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )
        async for attempt in AsyncRetrying(
            retry=retry_if_exception(_is_retryable),
            wait=wait_random_exponential(multiplier=2, max=60),
            stop=stop_after_attempt(6),
            before_sleep=before_sleep_log(logger, logging.WARNING),
            reraise=True,
        ):
            with attempt:
                await self._limiter.wait()
                response = await self._client.aio.models.generate_content(
                    model=self.model, contents=prompt, config=config
                )
                text = response.text or ""
                return schema.model_validate_json(text) if schema else text.strip()
        raise AssertionError("unreachable")


@lru_cache
def _client() -> genai.Client:
    api_key = get_settings().gemini_api_key
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set. Add it to backend/.env.")
    return genai.Client(api_key=api_key)


@lru_cache
def get_llm(kind: Literal["chat", "fast"] = "chat") -> LLM:
    settings = get_settings()
    model = settings.chat_model if kind == "chat" else settings.fast_model
    return LLM(_client(), model, settings.llm_rpm)
