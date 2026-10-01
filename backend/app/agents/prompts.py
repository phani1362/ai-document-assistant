"""Structured outputs and prompts for each agent in the graph."""

from typing import Literal

from pydantic import BaseModel, Field


class RouteDecision(BaseModel):
    route: Literal["research", "chitchat", "out_of_scope"]
    standalone_question: str = Field(
        description="The question rewritten to be understandable without the conversation"
    )
    needs_decomposition: bool = Field(
        description="True if answering needs facts about several papers/methods or several "
        "distinct facts that would be found in different places"
    )


ROUTER_SYSTEM = """You route messages for an assistant that answers questions about a corpus of
~200 research papers on retrieval-augmented generation (RAG), LLMs, and information retrieval.
- research: any question that could be answered from research papers in that area.
- chitchat: greetings, thanks, or questions about the assistant itself.
- out_of_scope: anything else (general knowledge, coding help, personal advice, other fields).
Rewrite the latest message as a standalone question, resolving references like "it" or
"that paper" from the conversation. Keep names, numbers, and acronyms exactly."""


class SubQuestions(BaseModel):
    sub_questions: list[str] = Field(description="2-3 standalone search questions")


PLANNER_SYSTEM = """You split a research question into 2-3 standalone sub-questions, each
answerable from a single paper or section. Each sub-question must name the specific paper,
method, or dataset it is about. Do not answer them."""


class EvidenceGrade(BaseModel):
    specifics: list[str] = Field(
        description="Every specific detail the question depends on: named papers, methods, "
        "models, datasets, domains (e.g. 'legal contracts'), populations, settings"
    )
    unmatched_specifics: list[str] = Field(
        description="Those specifics that the sources do not mention or are not about"
    )
    sufficient: bool = Field(
        description="The sources state the information asked for, about the right target"
    )
    missing: str = Field(description="What is missing, or empty if sufficient")
    rewritten_query: str = Field(
        description="A better search query to find the missing information, or empty"
    )

    @property
    def passes(self) -> bool:
        return self.sufficient and not self.unmatched_specifics


GRADER_SYSTEM = """You check whether retrieved sources can answer a question about research
papers, before any answer is written.
1. List the question's specifics: everything that identifies WHAT it asks about, whether by
   name (a paper, method, model, dataset) or by description (a domain, population, setting,
   e.g. "the study on contract review for law firms").
2. List which specifics the sources do not mention. A source about a different paper that
   only shares the general topic does not match: "a RAG benchmark" is not "the legal RAG
   benchmark in the question".
3. sufficient = true only if the sources state the information asked for AND are about the
   question's target.
If not sufficient, describe what is missing and write a search query likely to find it."""


class Sentence(BaseModel):
    text: str = Field(description="One sentence of the answer, without citation markers")
    sources: list[int] = Field(description="Numbers of the sources that support it")


class DraftAnswer(BaseModel):
    sentences: list[Sentence]


SYNTHESIZER_SYSTEM = """You answer a question about research papers using only the numbered
sources. Write a concise answer (1-5 sentences). Every sentence must be supported by the sources
you list for it. Do not use outside knowledge. Do not add filler sentences."""


class SentenceCheck(BaseModel):
    sentence: int
    supported: bool = Field(description="The cited sources state or directly imply it")


class Verification(BaseModel):
    checks: list[SentenceCheck]


VERIFIER_SYSTEM = """You fact-check an answer against its sources. For each numbered sentence,
decide whether the sources cited for it state or directly imply it. Numbers, names, and
comparisons must match exactly. Judge only from the source text, never from outside knowledge."""
