import os

# Tests run against their own database so they never touch (or process) real documents.
# This must be set before any app module reads settings.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://rag:rag@localhost:5432/rag_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from collections.abc import AsyncIterator  # noqa: E402

import psycopg  # noqa: E402
import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.db.session import get_sessionmaker  # noqa: E402
from app.main import app  # noqa: E402


def pytest_sessionstart(session: pytest.Session) -> None:
    url = make_url(TEST_DATABASE_URL)
    admin_dsn = url.set(drivername="postgresql", database="postgres").render_as_string(
        hide_password=False
    )
    with psycopg.connect(admin_dsn, autocommit=True) as connection:
        exists = connection.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (url.database,)
        ).fetchone()
        if not exists:
            connection.execute(f'CREATE DATABASE "{url.database}"')
    command.upgrade(Config("alembic.ini"), "head")


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def session() -> AsyncIterator[AsyncSession]:
    """A session whose work is rolled back, so tests never leave rows behind."""
    async with get_sessionmaker()() as s:
        yield s
        await s.rollback()


@pytest.fixture
async def clean_db() -> AsyncIterator[None]:
    """For tests whose code under test commits: start and finish with empty tables."""

    async def truncate() -> None:
        async with get_sessionmaker()() as s:
            await s.execute(text("TRUNCATE documents CASCADE"))
            await s.commit()

    await truncate()
    yield
    await truncate()
