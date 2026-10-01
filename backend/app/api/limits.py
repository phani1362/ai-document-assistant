"""Abuse and cost protection for public endpoints that spend LLM tokens."""

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.config import get_settings
from app.llm.chat import usage_tracker


class RateLimiter:
    """Per-key sliding windows (minute and day), in memory.

    Enough for one server instance; several instances would need a shared store (Redis).
    """

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, per_minute: int, per_day: int) -> None:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > 86_400:
            hits.popleft()
        last_minute = sum(1 for t in hits if now - t <= 60)
        if last_minute >= per_minute or len(hits) >= per_day:
            window = "minute" if last_minute >= per_minute else "day"
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"Rate limit reached ({per_minute}/minute, {per_day}/day). "
                f"Please try again in a {window}.",
            )
        hits.append(now)


chat_limiter = RateLimiter()


def client_ip(request: Request) -> str:
    # Behind Render's proxy the caller is the first X-Forwarded-For entry.
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def guard_chat(request: Request) -> None:
    settings = get_settings()
    usage_tracker.reset_if_new_day()
    spent = usage_tracker.total_cost()
    if spent is not None and spent >= settings.llm_budget_usd:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "The demo's daily LLM budget is used up. Please try again tomorrow.",
        )
    chat_limiter.check(client_ip(request), settings.chat_per_minute, settings.chat_per_day)
