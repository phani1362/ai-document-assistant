"""Build the golden evaluation set from the indexed corpus.

Answerable questions: sample one passage per paper, have the LLM write a self-contained
question plus a verbatim evidence quote, and keep it only if the quote really occurs in
the passage. Unanswerable questions: written from abstracts of arXiv papers that are
*not* in the corpus, so the right behavior is to abstain.

    uv run python -m evals.generate --answerable 60 --unanswerable 12
"""

import argparse
import asyncio
import logging
from pathlib import Path

import httpx
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.config import get_settings
from app.db.models import Chunk, ChunkLevel, Document, DocumentStatus
from app.db.session import get_sessionmaker
from app.ingestion.arxiv import DEFAULT_QUERY, USER_AGENT, ArxivPaper, Throttle, search
from app.llm.chat import LLM, get_llm
from evals.dataset import DEFAULT_DATASET, EvalItem, save_dataset
from evals.metrics import contains_evidence

logger = logging.getLogger(__name__)


class GeneratedQuestion(BaseModel):
    usable: bool = Field(description="False if the passage is too thin for a good question")
    question: str
    answer: str = Field(description="1-2 sentences, using only the passage")
    evidence: str = Field(description="Exact contiguous quote from the passage, 8-40 words")


QUESTION_SYSTEM = """You write evaluation questions for a search system over ~200 research papers
about retrieval-augmented generation (RAG). Given one passage from one paper, write ONE question:
- answerable from this passage alone;
- self-contained: name the specific method, system, benchmark, or paper title so the question
  is unambiguous among many similar papers. Never say "this paper", "the authors", or
  "the proposed method";
- about a specific fact: a result, number, design choice, definition, or finding;
- phrased the way a researcher would naturally ask it.
Also give a short answer and an evidence quote copied character-for-character from the passage.
Set usable=false for boilerplate, reference lists, or passages too thin for a good question."""

UNANSWERABLE_SYSTEM = """You write evaluation questions for a search system over research papers.
Given the title and abstract of a paper, write ONE question about a specific, distinctive detail
of it (a named method's result, a number, a dataset it introduces). Name the method or paper so
the question is specific to it. The question must be answerable only by someone who has read
this particular paper. Put an empty string in evidence and a one-sentence answer from the
abstract in answer; set usable=true."""


async def _sample_passages(count: int, seed: str) -> list[tuple[Chunk, Document]]:
    """One random substantial child chunk per ready document (deterministic for a seed)."""
    shuffle = func.md5(Chunk.content_hash + seed)
    ranked = (
        select(Chunk.id)
        .join(Document, Document.id == Chunk.document_id)
        .where(
            Document.status == DocumentStatus.READY,
            Chunk.level == ChunkLevel.CHILD,
            Chunk.token_count >= 120,
            ~Chunk.text.startswith("|"),
        )
        .distinct(Chunk.document_id)
        .order_by(Chunk.document_id, shuffle)
        .subquery()
    )
    async with get_sessionmaker()() as session:
        rows = await session.execute(
            select(Chunk, Document)
            .join(Document, Document.id == Chunk.document_id)
            .where(Chunk.id.in_(select(ranked.c.id)))
            .order_by(func.md5(Document.content_hash + seed))
            .limit(count)
        )
        return [(chunk, document) for chunk, document in rows]


async def _answerable(llm: LLM, count: int, seed: str) -> list[EvalItem]:
    items: list[EvalItem] = []
    passages = await _sample_passages(count, seed)
    if len(passages) < count:
        logger.warning("Only %s ready documents; generating %s questions", *[len(passages)] * 2)
    for chunk, document in passages:
        generated = await llm.generate(
            f"Paper: {document.title}\nSection: {chunk.section_path}\n\nPassage:\n{chunk.text}",
            system=QUESTION_SYSTEM,
            schema=GeneratedQuestion,
        )
        if not generated.usable:
            logger.info("Skipped unusable passage from %s", document.external_id)
            continue
        if not contains_evidence(chunk.text, [generated.evidence]):
            logger.info("Rejected non-verbatim evidence for %s", document.external_id)
            continue
        items.append(
            EvalItem(
                id=f"q{len(items) + 1:03d}",
                question=generated.question,
                answerable=True,
                reference_answer=generated.answer,
                evidence=[generated.evidence],
                source_external_id=document.external_id,
                source_title=document.title,
                kind="factual",
            )
        )
        logger.info("Generated %s: %s", items[-1].id, generated.question)
    return items


async def _papers_outside_corpus(count: int) -> list[ArxivPaper]:
    async with get_sessionmaker()() as session:
        known = set(
            await session.scalars(select(Document.external_id).where(Document.source == "arxiv"))
        )
    papers: list[ArxivPaper] = []
    throttle = Throttle(get_settings().arxiv_request_delay_seconds)
    async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, timeout=60) as client:
        async for paper in search(client, DEFAULT_QUERY, throttle):
            if paper.arxiv_id not in known:
                papers.append(paper)
            if len(papers) >= count:
                break
    return papers


async def _unanswerable(llm: LLM, count: int) -> list[EvalItem]:
    items: list[EvalItem] = []
    for paper in await _papers_outside_corpus(count):
        generated = await llm.generate(
            f"Title: {paper.title}\n\nAbstract:\n{paper.abstract}",
            system=UNANSWERABLE_SYSTEM,
            schema=GeneratedQuestion,
        )
        items.append(
            EvalItem(
                id=f"u{len(items) + 1:03d}",
                question=generated.question,
                answerable=False,
                reference_answer="Not answerable: the paper is not in the indexed corpus.",
                evidence=[],
                source_external_id=paper.arxiv_id,
                source_title=paper.title,
                kind="unanswerable",
            )
        )
        logger.info("Generated %s: %s", items[-1].id, generated.question)
    return items


async def generate(answerable: int, unanswerable: int, seed: str) -> list[EvalItem]:
    llm = get_llm("chat")
    return await _answerable(llm, answerable, seed) + await _unanswerable(llm, unanswerable)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the golden evaluation dataset.")
    parser.add_argument("--answerable", type=int, default=60)
    parser.add_argument("--unanswerable", type=int, default=12)
    parser.add_argument("--seed", default="golden-v1")
    parser.add_argument("--out", default=str(DEFAULT_DATASET))
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    items = asyncio.run(generate(args.answerable, args.unanswerable, args.seed))
    save_dataset(items, Path(args.out))
    logger.info("Wrote %s items to %s", len(items), args.out)


if __name__ == "__main__":
    main()
