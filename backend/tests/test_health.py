from httpx import AsyncClient


async def test_health_reports_database_ok(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


async def test_ping_does_not_need_the_database(client: AsyncClient) -> None:
    response = await client.get("/ping")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_rate_limiter_enforces_minute_and_day_windows() -> None:
    import pytest
    from fastapi import HTTPException

    from app.api.limits import RateLimiter

    limiter = RateLimiter()
    for _ in range(3):
        limiter.check("1.2.3.4", per_minute=3, per_day=10)
    with pytest.raises(HTTPException) as error:
        limiter.check("1.2.3.4", per_minute=3, per_day=10)
    assert error.value.status_code == 429
    limiter.check("5.6.7.8", per_minute=3, per_day=10)  # other clients unaffected


async def test_chat_rejects_empty_and_oversized_questions(client: AsyncClient) -> None:
    empty = await client.post("/ask", json={"question": ""})
    huge = await client.post("/ask", json={"question": "x" * 1001})

    assert (empty.status_code, huge.status_code) == (422, 422)
