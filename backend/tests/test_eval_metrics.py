from evals.judge import ClaimVerdict, Judgement, faithfulness
from evals.metrics import (
    citations_valid,
    contains_evidence,
    first_relevant_rank,
    hit_at_k,
    percentile,
    reciprocal_rank,
)
from evals.run import summarize


def test_evidence_matching_ignores_case_whitespace_and_punctuation() -> None:
    chunk = "Results show that   BM25, with k1=1.2,\noutperforms dense retrieval."
    assert contains_evidence(chunk, ["bm25 with k1 1.2 outperforms dense retrieval"])
    assert not contains_evidence(chunk, ["dense retrieval outperforms BM25"])
    assert not contains_evidence(chunk, [""])


def test_rank_metrics() -> None:
    texts = ["unrelated", "also unrelated", "the answer is 42 here"]
    rank = first_relevant_rank(texts, ["answer is 42"])

    assert rank == 3
    assert hit_at_k(rank, 1) == 0.0
    assert hit_at_k(rank, 5) == 1.0
    assert reciprocal_rank(rank) == 1 / 3
    assert reciprocal_rank(None) == 0.0


def test_citation_validity() -> None:
    assert citations_valid("A [1] and B [2][3].", source_count=3)
    assert not citations_valid("A [4].", source_count=3)
    assert citations_valid("No citations at all.", source_count=0)


def test_faithfulness_is_share_of_supported_claims() -> None:
    judgement = Judgement(
        abstained=False,
        claims=[
            ClaimVerdict(claim="a", supported=True),
            ClaimVerdict(claim="b", supported=True),
            ClaimVerdict(claim="c", supported=False),
        ],
        correctness=4,
        reasoning="",
    )
    assert faithfulness(judgement) == 2 / 3
    assert faithfulness(judgement.model_copy(update={"claims": []})) is None


def test_percentile() -> None:
    assert percentile([5.0, 1.0, 3.0], 50) == 3.0
    assert percentile([], 50) is None


def test_summarize_separates_answerable_and_unanswerable() -> None:
    base = {"retrieval_seconds": 0.1, "total_seconds": 2.0, "citations_valid": True}
    records = [
        {**base, "kind": "factual", "rank": 1, "doc_rank": 1, "context_has_evidence": True,
         "faithfulness": 1.0, "correctness": 5, "abstained": False, "has_citation": True},
        {**base, "kind": "factual", "rank": None, "doc_rank": 7, "context_has_evidence": False,
         "faithfulness": None, "correctness": 1, "abstained": True, "has_citation": False},
        {**base, "kind": "unanswerable", "context_has_evidence": False,
         "faithfulness": None, "correctness": 5, "abstained": True, "has_citation": False},
    ]  # fmt: skip

    summary = summarize(records, k=10)

    assert summary["retrieval"]["hit@1"] == 0.5
    assert summary["retrieval"]["paper_hit@5"] == 0.5
    assert summary["answers"]["false_abstention"] == 0.5
    assert summary["answers"]["abstention_accuracy"] == 1.0
    assert summary["answers"]["correctness"] == 0.5
    assert summary["answers"]["faithfulness"] == 1.0


def test_usage_tracker_costs_known_models_only() -> None:
    from app.llm.chat import UsageTracker

    tracker = UsageTracker()
    tracker.record("gpt-4.1-mini", input_tokens=1_000_000, output_tokens=500_000)
    assert tracker.total_cost() == 1.2
    tracker.record("some-unpriced-model", input_tokens=10, output_tokens=10)
    assert tracker.total_cost() is None
