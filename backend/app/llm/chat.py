"""Provider-agnostic LLM client: structured (JSON-schema) output, rate limiting, retries,
and token/cost accounting. OpenAI and Gemini are implemented; adding a provider means
implementing `_call`.
"""

import asyncio
import logging
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Literal, overload

import openai
from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types
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

# USD per 1M (input, output) tokens. Used only for the cost estimates printed by evals;
# check the provider's pricing page when adding a model.
PRICES: dict[str, tuple[float, float]] = {
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1-nano": (0.10, 0.40),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-5-mini": (0.25, 2.00),
    "gpt-5-nano": (0.05, 0.40),
}


@dataclass
class ModelUsage:
    calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0

    def cost(self, model: str) -> float | None:
        if model not in PRICES:
            return None
        input_price, output_price = PRICES[model]
        return (self.input_tokens * input_price + self.output_tokens * output_price) / 1e6


@dataclass
class UsageTracker:
    by_model: dict[str, ModelUsage] = field(default_factory=dict)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def record(self, model: str, input_tokens: int, output_tokens: int) -> None:
        with self._lock:
            usage = self.by_model.setdefault(model, ModelUsage())
            usage.calls += 1
            usage.input_tokens += input_tokens
            usage.output_tokens += output_tokens

    def total_cost(self) -> float | None:
        costs = [usage.cost(model) for model, usage in self.by_model.items()]
        known = [cost for cost in costs if cost is not None]
        return round(sum(known), 4) if len(known) == len(costs) else None

    def summary(self) -> dict[str, object]:
        return {
            "models": {
                model: {**vars(usage), "cost_usd": usage.cost(model)}
                for model, usage in self.by_model.items()
            },
            "total_cost_usd": self.total_cost(),
        }


usage_tracker = UsageTracker()


class BudgetExceededError(RuntimeError):
    pass


def _is_retryable(error: BaseException) -> bool:
    if isinstance(
        error, openai.RateLimitError | openai.APIConnectionError | openai.APITimeoutError
    ):
        # insufficient_quota is a billing limit (e.g. the spend cap), not a transient error.
        return getattr(error, "code", None) != "insufficient_quota"
    if isinstance(error, openai.APIStatusError):
        return error.status_code >= 500
    if isinstance(error, genai_errors.APIError):
        return error.code == 429 or error.code >= 500
    # Structured output that fails validation is usually a one-off; ask again.
    return isinstance(error, ValidationError)


class _RateLimiter:
    """Spaces calls to stay under a requests-per-minute quota."""

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


class LLM(ABC):
    def __init__(self, model: str, rpm: int) -> None:
        self.model = model
        self._limiter = _RateLimiter(rpm)

    @abstractmethod
    async def _call(
        self, prompt: str, system: str, schema: type[BaseModel] | None
    ) -> tuple[str, int, int]:
        """Return (raw text, input tokens, output tokens)."""

    @overload
    async def generate(self, prompt: str, *, system: str = ..., schema: None = None) -> str: ...

    @overload
    async def generate[T: BaseModel](
        self, prompt: str, *, system: str = ..., schema: type[T]
    ) -> T: ...

    async def generate[T: BaseModel](
        self, prompt: str, *, system: str = "", schema: type[T] | None = None
    ) -> str | T:
        """Generate text, or an instance of `schema` when one is given."""
        async for attempt in AsyncRetrying(
            retry=retry_if_exception(_is_retryable),
            wait=wait_random_exponential(multiplier=2, max=60),
            stop=stop_after_attempt(6),
            before_sleep=before_sleep_log(logger, logging.WARNING),
            reraise=True,
        ):
            with attempt:
                spent = usage_tracker.total_cost()
                budget = get_settings().llm_budget_usd
                if spent is not None and spent >= budget:
                    raise BudgetExceededError(
                        f"Estimated LLM spend ${spent} reached LLM_BUDGET_USD=${budget}"
                    )
                await self._limiter.wait()
                text, input_tokens, output_tokens = await self._call(prompt, system, schema)
                usage_tracker.record(self.model, input_tokens, output_tokens)
                return schema.model_validate_json(text) if schema else text.strip()
        raise AssertionError("unreachable")


class OpenAILLM(LLM):
    def __init__(self, client: openai.AsyncOpenAI, model: str, rpm: int) -> None:
        super().__init__(model, rpm)
        self._client = client

    async def _call(
        self, prompt: str, system: str, schema: type[BaseModel] | None
    ) -> tuple[str, int, int]:
        messages: list[openai.types.chat.ChatCompletionMessageParam] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        # Reasoning models (gpt-5*, o*) only accept the default temperature.
        temperature = openai.omit if self.model.startswith(("gpt-5", "o")) else 0.0
        completion: openai.types.chat.ChatCompletion
        if schema is not None:
            completion = await self._client.chat.completions.parse(
                model=self.model, messages=messages, response_format=schema, temperature=temperature
            )
        else:
            completion = await self._client.chat.completions.create(
                model=self.model, messages=messages, temperature=temperature
            )
        usage = completion.usage
        return (
            completion.choices[0].message.content or "",
            usage.prompt_tokens if usage else 0,
            usage.completion_tokens if usage else 0,
        )


class GeminiLLM(LLM):
    def __init__(self, client: genai.Client, model: str, rpm: int) -> None:
        super().__init__(model, rpm)
        self._client = client

    async def _call(
        self, prompt: str, system: str, schema: type[BaseModel] | None
    ) -> tuple[str, int, int]:
        config = genai_types.GenerateContentConfig(
            system_instruction=system or None,
            temperature=0,
            response_mime_type="application/json" if schema else None,
            response_schema=schema,
            automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(disable=True),
        )
        response = await self._client.aio.models.generate_content(
            model=self.model, contents=prompt, config=config
        )
        usage = response.usage_metadata
        return (
            response.text or "",
            (usage.prompt_token_count or 0) if usage else 0,
            (usage.candidates_token_count or 0) if usage else 0,
        )


@lru_cache
def get_llm(kind: Literal["chat", "fast"] = "chat") -> LLM:
    settings = get_settings()
    model = settings.chat_model if kind == "chat" else settings.fast_model
    if settings.llm_provider == "openai":
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set. Add it to backend/.env.")
        client = openai.AsyncOpenAI(api_key=settings.openai_api_key, max_retries=0)
        return OpenAILLM(client, model, settings.llm_rpm)
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set. Add it to backend/.env.")
    return GeminiLLM(genai.Client(api_key=settings.gemini_api_key), model, settings.llm_rpm)
