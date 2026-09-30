"""Run a pipeline over the golden set and report retrieval and answer metrics.

uv run python -m evals.run --pipeline baseline
uv run python -m evals.run --pipeline baseline --retrieval-only   # no LLM calls
"""

import argparse
import asyncio
import json
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.session import get_sessionmaker
from app.llm.chat import LLM, get_llm
from app.llm.embeddings import Embedder, get_embedder
from app.rag.baseline import RagResult, answer_baseline, format_sources
from app.retrieval.search import RetrievedChunk, dense_search
from evals.dataset import DEFAULT_DATASET, EvalItem, load_dataset
from evals.judge import faithfulness, judge_answer
from evals.metrics import (
    citations,
    citations_valid,
    contains_evidence,
    first_relevant_rank,
    hit_at_k,
    mean,
    percentile,
    reciprocal_rank,
)

logger = logging.getLogger(__name__)
RESULTS_DIR = Path(__file__).parent / "results"

Retrieve = Callable[[AsyncSession, Embedder, str, int], Awaitable[list[RetrievedChunk]]]
Answer = Callable[[AsyncSession, Embedder, LLM, str, list[RetrievedChunk]], Awaitable[RagResult]]


@dataclass(frozen=True)
class Pipeline:
    retrieve: Retrieve
    answer: Answer


async def _baseline_answer(
    session: AsyncSession,
    embedder: Embedder,
    llm: LLM,
    question: str,
    retrieved: list[RetrievedChunk],
) -> RagResult:
    k = get_settings().retrieval_top_k
    return await answer_baseline(session, embedder, llm, question, k=k, retrieved=retrieved)


PIPELINES: dict[str, Pipeline] = {
    "baseline": Pipeline(retrieve=dense_search, answer=_baseline_answer),
}


async def evaluate_item(
    item: EvalItem,
    pipeline: Pipeline,
    embedder: Embedder,
    llm: LLM | None,
    judge: LLM | None,
    k: int,
) -> dict[str, Any]:
    record: dict[str, Any] = {"id": item.id, "kind": item.kind, "question": item.question}
    async with get_sessionmaker()() as session:
        started = time.perf_counter()
        retrieved = await pipeline.retrieve(session, embedder, item.question, k)
        record["retrieval_seconds"] = round(time.perf_counter() - started, 3)
        record["retrieved"] = [
            {"external_id": c.external_id, "section": c.section_path, "score": round(c.score, 4)}
            for c in retrieved
        ]
        if item.answerable:
            rank = first_relevant_rank([c.text for c in retrieved], item.evidence)
            doc_ids = [c.external_id for c in retrieved]
            record["rank"] = rank
            record["doc_rank"] = (
                doc_ids.index(item.source_external_id) + 1
                if item.source_external_id in doc_ids
                else None
            )

        if llm is None or judge is None:
            return record
        result = await pipeline.answer(session, embedder, llm, item.question, retrieved)
    record["total_seconds"] = round(time.perf_counter() - started, 3)
    record["answer"] = result.answer
    record["sources"] = len(result.passages)
    record["context_has_evidence"] = item.answerable and any(
        contains_evidence(passage.text, item.evidence) for passage in result.passages
    )
    record["citations_valid"] = citations_valid(result.answer, len(result.passages))
    record["has_citation"] = bool(citations(result.answer))

    judgement = await judge_answer(
        judge,
        question=item.question,
        sources=format_sources(result.passages),
        answer=result.answer,
        reference=item.reference_answer,
    )
    record["abstained"] = judgement.abstained
    record["faithfulness"] = faithfulness(judgement)
    record["correctness"] = judgement.correctness
    record["judge_reasoning"] = judgement.reasoning
    record["unsupported_claims"] = [c.claim for c in judgement.claims if not c.supported]
    return record


def summarize(records: list[dict[str, Any]], k: int) -> dict[str, Any]:
    answerable = [r for r in records if r["kind"] != "unanswerable"]
    unanswerable = [r for r in records if r["kind"] == "unanswerable"]
    ranks = [r["rank"] for r in answerable]
    summary: dict[str, Any] = {
        "questions": len(records),
        "answerable": len(answerable),
        "unanswerable": len(unanswerable),
        "retrieval": {
            "hit@1": mean([hit_at_k(rank, 1) for rank in ranks]),
            "hit@5": mean([hit_at_k(rank, 5) for rank in ranks]),
            f"hit@{k}": mean([hit_at_k(rank, k) for rank in ranks]),
            f"mrr@{k}": mean([reciprocal_rank(rank) for rank in ranks]),
            "paper_hit@5": mean([hit_at_k(r["doc_rank"], 5) for r in answerable]),
            "p50_seconds": percentile([r["retrieval_seconds"] for r in records], 50),
        },
    }
    if records and all("correctness" in r for r in records):
        summary["answers"] = {
            "context_recall": mean([float(r["context_has_evidence"]) for r in answerable]),
            "faithfulness": mean(
                [r["faithfulness"] for r in records if r["faithfulness"] is not None]
            ),
            "correctness": mean([(r["correctness"] - 1) / 4 for r in answerable]),
            "answered_correctly": mean([float(r["correctness"] >= 4) for r in answerable]),
            "false_abstention": mean([float(r["abstained"]) for r in answerable]),
            "abstention_accuracy": mean([float(r["abstained"]) for r in unanswerable]),
            "citations_valid": mean([float(r["citations_valid"]) for r in records]),
            "cited_when_answering": mean(
                [float(r["has_citation"]) for r in records if not r["abstained"]]
            ),
            "p50_seconds": percentile([r["total_seconds"] for r in records], 50),
            "p95_seconds": percentile([r["total_seconds"] for r in records], 95),
        }
    return summary


def to_markdown(name: str, summary: dict[str, Any], config: dict[str, Any]) -> str:
    lines = [
        f"# Eval: {name}",
        "",
        f"{summary['questions']} questions ({summary['answerable']} answerable, "
        f"{summary['unanswerable']} unanswerable). Config: `{json.dumps(config)}`",
    ]
    for section in ("retrieval", "answers"):
        if section in summary:
            lines += ["", f"## {section.title()}", "", "| Metric | Value |", "|---|---|"]
            lines += [f"| {metric} | {value} |" for metric, value in summary[section].items()]
    return "\n".join(lines) + "\n"


async def run(
    pipeline_name: str, dataset: Path, k: int, retrieval_only: bool, limit: int | None
) -> dict[str, Any]:
    items = load_dataset(dataset)[:limit]
    pipeline = PIPELINES[pipeline_name]
    embedder = get_embedder()
    llm = None if retrieval_only else get_llm("chat")
    judge = None if retrieval_only else get_llm("chat")
    records = []
    for number, item in enumerate(items, start=1):
        records.append(await evaluate_item(item, pipeline, embedder, llm, judge, k))
        logger.info("[%s/%s] %s", number, len(items), item.id)

    settings = get_settings()
    config = {
        "pipeline": pipeline_name,
        "k": k,
        "top_k_context": settings.retrieval_top_k,
        "embedding": embedder.name,
        "llm": None if retrieval_only else settings.chat_model,
        "chunking": [
            settings.child_chunk_tokens,
            settings.child_overlap_tokens,
            settings.parent_chunk_tokens,
        ],
    }
    summary = summarize(records, k)
    stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M")
    name = f"{stamp}-{pipeline_name}{'-retrieval' if retrieval_only else ''}"
    RESULTS_DIR.mkdir(exist_ok=True)
    (RESULTS_DIR / f"{name}.json").write_text(
        json.dumps({"config": config, "summary": summary, "records": records}, indent=2)
    )
    (RESULTS_DIR / f"{name}.md").write_text(to_markdown(name, summary, config))
    print(to_markdown(name, summary, config))
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a RAG pipeline on the golden set.")
    parser.add_argument("--pipeline", choices=sorted(PIPELINES), default="baseline")
    parser.add_argument("--dataset", default=str(DEFAULT_DATASET))
    parser.add_argument("--k", type=int, default=10, help="retrieval depth for metrics")
    parser.add_argument("--retrieval-only", action="store_true", help="skip LLM answer + judge")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    asyncio.run(run(args.pipeline, Path(args.dataset), args.k, args.retrieval_only, args.limit))


if __name__ == "__main__":
    main()
