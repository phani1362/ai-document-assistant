"""Deterministic metrics. LLM-judged metrics live in judge.py."""

import re
import statistics


def normalize(text: str) -> str:
    """Lowercase and collapse whitespace/punctuation so quoting differences don't matter."""
    return " ".join(re.sub(r"[^\w\s]", " ", text.lower()).split())


def contains_evidence(text: str, evidence: list[str]) -> bool:
    haystack = normalize(text)
    return any(normalize(quote) in haystack for quote in evidence if quote.strip())


def first_relevant_rank(texts: list[str], evidence: list[str]) -> int | None:
    """1-based rank of the first text containing the evidence, or None."""
    for rank, text in enumerate(texts, start=1):
        if contains_evidence(text, evidence):
            return rank
    return None


def hit_at_k(rank: int | None, k: int) -> float:
    return 1.0 if rank is not None and rank <= k else 0.0


def reciprocal_rank(rank: int | None) -> float:
    return 1.0 / rank if rank is not None else 0.0


_CITATION = re.compile(r"\[(\d+)\]")


def citations(answer: str) -> list[int]:
    return [int(number) for number in _CITATION.findall(answer)]


def citations_valid(answer: str, source_count: int) -> bool:
    """Every [n] refers to a source that was actually provided."""
    return all(1 <= number <= source_count for number in citations(answer))


def mean(values: list[float]) -> float | None:
    return round(statistics.fmean(values), 3) if values else None


def percentile(values: list[float], pct: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round(pct / 100 * (len(ordered) - 1))))
    return round(ordered[index], 2)
