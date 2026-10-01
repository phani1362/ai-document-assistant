"""Bulk-load arXiv papers: search the arXiv API, fetch each paper's HTML, queue it.

Only papers with an HTML rendering are loaded (most papers since late 2023). HTML
keeps real section headings, which PDFs lose, and section-aware chunking needs them.

    uv run python -m app.ingestion.arxiv --max-papers 300
"""

import argparse
import asyncio
import logging
import re
import time
import xml.etree.ElementTree as ET
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from tenacity import (
    AsyncRetrying,
    before_sleep_log,
    retry_if_exception,
    stop_after_attempt,
    wait_random_exponential,
)

from app.config import get_settings
from app.db.models import Document, DocumentStatus
from app.db.session import get_sessionmaker
from app.ingestion.chunking import content_hash
from app.ingestion.parsers import parse_arxiv_html

logger = logging.getLogger(__name__)

API_URL = "https://export.arxiv.org/api/query"
HTML_URL = "https://arxiv.org/html/{arxiv_id}"
USER_AGENT = "rag-portfolio-ingest/0.1 (+https://github.com/phani1362/ai-document-assistant)"
DEFAULT_QUERY = '(cat:cs.CL OR cat:cs.AI OR cat:cs.IR) AND abs:"retrieval augmented"'
_ATOM = "{http://www.w3.org/2005/Atom}"
_PAGE_SIZE = 100


@dataclass(frozen=True)
class ArxivPaper:
    arxiv_id: str
    title: str
    authors: list[str]
    abstract: str
    published: datetime
    categories: list[str]

    @property
    def url(self) -> str:
        return f"https://arxiv.org/abs/{self.arxiv_id}"


class Throttle:
    """Space out requests to one host, as arXiv's API terms require."""

    def __init__(self, delay: float) -> None:
        self._delay = delay
        self._last = 0.0

    async def wait(self) -> None:
        remaining = self._last + self._delay - time.monotonic()
        if remaining > 0:
            await asyncio.sleep(remaining)
        self._last = time.monotonic()


def parse_feed(xml: str) -> list[ArxivPaper]:
    papers = []
    for entry in ET.fromstring(xml).iter(f"{_ATOM}entry"):
        raw_id = entry.findtext(f"{_ATOM}id", "")
        # "http://arxiv.org/abs/2312.10997v5" -> "2312.10997"
        arxiv_id = re.sub(r"v\d+$", "", raw_id.rsplit("/abs/", 1)[-1])
        papers.append(
            ArxivPaper(
                arxiv_id=arxiv_id,
                title=" ".join(entry.findtext(f"{_ATOM}title", "").split()),
                authors=[
                    name.text.strip()
                    for name in entry.iter(f"{_ATOM}name")
                    if name.text and name.text.strip()
                ],
                abstract=" ".join(entry.findtext(f"{_ATOM}summary", "").split()),
                published=datetime.fromisoformat(
                    entry.findtext(f"{_ATOM}published", "").replace("Z", "+00:00")
                ),
                categories=[
                    term
                    for category in entry.iter(f"{_ATOM}category")
                    if (term := category.get("term"))
                ],
            )
        )
    return papers


def _is_transient(error: BaseException) -> bool:
    if isinstance(error, httpx.HTTPStatusError):
        return error.response.status_code in (429, 500, 502, 503, 504)
    return isinstance(error, httpx.TransportError)


async def _get(
    client: httpx.AsyncClient, url: str, throttle: Throttle, **params: str | int
) -> httpx.Response:
    """GET with arXiv's request spacing, retrying rate limits and transient failures."""
    async for attempt in AsyncRetrying(
        retry=retry_if_exception(_is_transient),
        wait=wait_random_exponential(multiplier=5, max=120),
        stop=stop_after_attempt(6),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True,
    ):
        with attempt:
            await throttle.wait()
            response = await client.get(url, params=params)
            if response.status_code != 404:
                response.raise_for_status()
            return response
    raise AssertionError("unreachable")


async def search(
    client: httpx.AsyncClient, query: str, throttle: Throttle
) -> AsyncIterator[ArxivPaper]:
    start = 0
    while True:
        response = await _get(
            client,
            API_URL,
            throttle,
            search_query=query,
            start=start,
            max_results=_PAGE_SIZE,
            sortBy="relevance",
        )
        papers = parse_feed(response.text)
        if not papers:
            return
        for paper in papers:
            yield paper
        start += _PAGE_SIZE


async def fetch_html(
    client: httpx.AsyncClient, arxiv_id: str, cache_dir: Path, throttle: Throttle
) -> str | None:
    cached = cache_dir / f"{arxiv_id.replace('/', '_')}.html"
    if await asyncio.to_thread(cached.exists):
        return await asyncio.to_thread(cached.read_text)
    response = await _get(client, HTML_URL.format(arxiv_id=arxiv_id), throttle)
    if response.status_code == 404:
        return None
    await asyncio.to_thread(cached.write_text, response.text)
    return response.text


async def load_arxiv(query: str, max_papers: int) -> int:
    """Queue up to `max_papers` new papers for ingestion. Returns how many were queued."""
    settings = get_settings()
    cache_dir = Path(settings.arxiv_cache_dir)
    await asyncio.to_thread(cache_dir.mkdir, parents=True, exist_ok=True)
    throttle = Throttle(settings.arxiv_request_delay_seconds)
    sessionmaker = get_sessionmaker()
    queued = skipped = 0

    async with sessionmaker() as session:
        existing = set(
            await session.scalars(select(Document.external_id).where(Document.source == "arxiv"))
        )

    async with httpx.AsyncClient(
        headers={"User-Agent": USER_AGENT}, timeout=60, follow_redirects=True
    ) as client:
        async for paper in search(client, query, throttle):
            if queued >= max_papers:
                break
            if paper.arxiv_id in existing:
                continue
            existing.add(paper.arxiv_id)
            html = await fetch_html(client, paper.arxiv_id, cache_dir, throttle)
            try:
                title, markdown = parse_arxiv_html(html) if html else ("", "")
            except ValueError:
                markdown = ""
            if not markdown:
                skipped += 1
                logger.info("Skipping %s: no HTML version", paper.arxiv_id)
                continue

            async with sessionmaker() as session, session.begin():
                result = await session.execute(
                    insert(Document)
                    .values(
                        source="arxiv",
                        external_id=paper.arxiv_id,
                        title=title or paper.title,
                        authors=paper.authors,
                        abstract=paper.abstract,
                        url=paper.url,
                        published_at=paper.published,
                        extra={"categories": paper.categories},
                        content=markdown,
                        content_hash=content_hash(markdown),
                        status=DocumentStatus.QUEUED,
                    )
                    # Skip papers already loaded (same id) or duplicated (same content).
                    .on_conflict_do_nothing()
                )
            if not result.rowcount:  # type: ignore[attr-defined]
                continue
            queued += 1
            logger.info("Queued %s/%s: %s", queued, max_papers, paper.title)

    logger.info("Queued %s papers, skipped %s without HTML", queued, skipped)
    return queued


def main() -> None:
    parser = argparse.ArgumentParser(description="Queue arXiv papers for ingestion.")
    parser.add_argument("--query", default=DEFAULT_QUERY, help="arXiv API search query")
    parser.add_argument("--max-papers", type=int, default=300)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    asyncio.run(load_arxiv(args.query, args.max_papers))


if __name__ == "__main__":
    main()
