"""LLM-as-judge for answer quality (faithfulness, correctness, abstention).

Faithfulness is judged claim by claim against the sources the pipeline actually used,
so it measures grounding, not whether the model happens to know the answer.
"""

from pydantic import BaseModel, Field, field_validator

from app.llm.chat import LLM


class ClaimVerdict(BaseModel):
    claim: str
    supported: bool = Field(description="True only if the sources state or directly imply it")


class Judgement(BaseModel):
    abstained: bool = Field(description="The answer declines to answer / says it is not found")
    claims: list[ClaimVerdict] = Field(description="Each factual claim in the answer, judged")
    correctness: int = Field(description="1-5 agreement with the reference answer")
    reasoning: str

    # Range checked here rather than in the JSON schema: not every provider's
    # structured-output mode supports minimum/maximum.
    @field_validator("correctness")
    @classmethod
    def _in_range(cls, value: int) -> int:
        return min(5, max(1, value))


JUDGE_SYSTEM = """You are a strict evaluator of a question-answering system over research papers.
Given the question, the SOURCES the system was shown, its ANSWER, and a REFERENCE answer:
1. abstained: true if the answer says the information is not available / cannot be found.
2. claims: split the answer into atomic factual claims (ignore citations like [1]).
   For each, supported = true only if the SOURCES support it. Do not use outside knowledge.
   If the answer abstained, return an empty list.
3. correctness (1-5) compares the answer with the REFERENCE answer:
   5 = same facts, complete; 4 = correct, minor omissions; 3 = partially correct;
   2 = mostly wrong or missing the key fact; 1 = wrong, or abstained when a reference exists.
   If the reference says the question is unanswerable, give 5 for an abstention and 1 for
   any substantive answer.
4. reasoning: one or two sentences."""


async def judge_answer(
    llm: LLM, *, question: str, sources: str, answer: str, reference: str
) -> Judgement:
    return await llm.generate(
        f"QUESTION:\n{question}\n\nSOURCES:\n{sources or '(none)'}\n\n"
        f"ANSWER:\n{answer}\n\nREFERENCE ANSWER:\n{reference}",
        system=JUDGE_SYSTEM,
        schema=Judgement,
    )


def faithfulness(judgement: Judgement) -> float | None:
    """Share of claims supported by the sources; None when there are no claims to judge."""
    if not judgement.claims:
        return None
    return sum(claim.supported for claim in judgement.claims) / len(judgement.claims)
