from httpx import AsyncClient


async def test_health_reports_database_ok(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


async def test_ping_does_not_need_the_database(client: AsyncClient) -> None:
    response = await client.get("/ping")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
