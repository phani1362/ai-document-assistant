import uuid
from collections import defaultdict
from typing import Any

from pydantic import BaseModel

from app.agents.graph import (
    CHITCHAT_REPLY,
    AgentDeps,
    AgentResult,
    build_graph,
    run_agents,
    stream_agents,
)
from app.agents.prompts import (
    DraftAnswer,
    EvidenceGrade,
    RouteDecision,
    SubQuestions,
    Verification,
)
from app.llm.chat import LLM
from app.rag.baseline import ABSTAIN_MESSAGE
from app.retrieval.search import ContextPassage, RetrievedChunk


class ScriptedLLM(LLM):
    """Returns queued responses per output schema, so each agent's reply is scripted."""

    def __init__(self, script: dict[type[BaseModel], list[BaseModel]]) -> None:
        super().__init__("scripted", rpm=100_000)
        self._script = {schema: list(responses) for schema, responses in script.items()}
        self.calls: dict[str, int] = defaultdict(int)

    async def _call(
        self, prompt: str, system: str, schema: type[BaseModel] | None
    ) -> tuple[str, int, int]:
        assert schema is not None
        self.calls[schema.__name__] += 1
        return self._script[schema].pop(0).model_dump_json(), 0, 0


def _chunk(name: str) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=uuid.uuid5(uuid.NAMESPACE_OID, name),
        parent_id=uuid.uuid5(uuid.NAMESPACE_OID, "parent-" + name),
        document_id=uuid.uuid4(),
        external_id=name,
        title=f"Paper {name}",
        section_path="Results",
        text=f"Findings of {name}.",
        score=3.0,
    )


class FakeRetrieval:
    def __init__(self) -> None:
        self.queries: list[str] = []

    async def retrieve(self, query: str, k: int) -> list[RetrievedChunk]:
        self.queries.append(query)
        return [_chunk(f"{query}-{i}") for i in range(2)]

    async def load_passages(self, chunks: list[RetrievedChunk]) -> list[ContextPassage]:
        return [
            ContextPassage(
                parent_id=c.parent_id or c.chunk_id,
                document_id=c.document_id,
                external_id=c.external_id,
                title=c.title,
                url=None,
                section_path=c.section_path,
                text=c.text,
            )
            for c in chunks
        ]


def _route(needs_decomposition: bool = False, route: Any = "research") -> RouteDecision:
    return RouteDecision(
        route=route, standalone_question="What did X find?", needs_decomposition=needs_decomposition
    )


def _grade(ok: bool, rewrite: str = "") -> EvidenceGrade:
    return EvidenceGrade(
        specifics=["X"],
        unmatched_specifics=[] if ok else ["X"],
        sufficient=ok,
        missing="" if ok else "Nothing about X",
        rewritten_query=rewrite,
    )


DRAFT = DraftAnswer.model_validate(
    {
        "sentences": [
            {"text": "X improves recall by 12%.", "sources": [1]},
            {"text": "X was invented in 1850.", "sources": [2]},
        ]
    }
)


def _deps(chat: ScriptedLLM, fast: ScriptedLLM, retrieval: FakeRetrieval) -> AgentDeps:
    return AgentDeps(
        chat_llm=chat,
        fast_llm=fast,
        retrieve=retrieval.retrieve,
        load_passages=retrieval.load_passages,
    )


async def test_answers_and_verifier_removes_unsupported_sentences() -> None:
    fast = ScriptedLLM({RouteDecision: [_route()]})
    chat = ScriptedLLM(
        {
            EvidenceGrade: [_grade(True)],
            DraftAnswer: [DRAFT],
            Verification: [
                Verification.model_validate(
                    {
                        "checks": [
                            {"sentence": 1, "supported": True},
                            {"sentence": 2, "supported": False},
                        ]
                    }
                )
            ],
        }
    )
    retrieval = FakeRetrieval()

    result = await run_agents(build_graph(_deps(chat, fast, retrieval)), "What did X find?")

    assert result.answer == "X improves recall by 12%. [1]"
    assert not result.abstained
    assert (result.verified_sentences, result.removed_sentences) == (1, 1)
    assert retrieval.queries == ["What did X find?"]
    assert [step["agent"] for step in result.steps] == [
        "router",
        "retriever",
        "assembler",
        "grader",
        "synthesizer",
        "verifier",
    ]


async def test_insufficient_evidence_triggers_one_corrective_search() -> None:
    fast = ScriptedLLM({RouteDecision: [_route()]})
    chat = ScriptedLLM(
        {
            EvidenceGrade: [_grade(False, rewrite="X recall results"), _grade(True)],
            DraftAnswer: [DRAFT],
            Verification: [
                Verification.model_validate(
                    {
                        "checks": [
                            {"sentence": 1, "supported": True},
                            {"sentence": 2, "supported": True},
                        ]
                    }
                )
            ],
        }
    )
    retrieval = FakeRetrieval()

    result = await run_agents(build_graph(_deps(chat, fast, retrieval)), "What did X find?")

    assert retrieval.queries == ["What did X find?", "X recall results"]
    assert result.retries == 1
    assert not result.abstained
    # Sources from both searches are kept.
    assert len(result.retrieved) == 4


async def test_abstains_when_evidence_stays_insufficient() -> None:
    fast = ScriptedLLM({RouteDecision: [_route()]})
    chat = ScriptedLLM({EvidenceGrade: [_grade(False, "retry"), _grade(False, "again")]})
    retrieval = FakeRetrieval()

    result = await run_agents(build_graph(_deps(chat, fast, retrieval)), "What did X find?")

    assert result.abstained
    assert result.answer.startswith(ABSTAIN_MESSAGE)
    assert "Nothing about X" in result.answer
    assert "closest papers" in result.answer
    assert len(retrieval.queries) == 2  # one corrective retry, then stop
    assert chat.calls["DraftAnswer"] == 0  # never drafts an answer from bad evidence


async def test_complex_questions_are_decomposed_and_searched_in_parallel() -> None:
    fast = ScriptedLLM(
        {
            RouteDecision: [_route(needs_decomposition=True)],
            SubQuestions: [SubQuestions(sub_questions=["What did X find?", "What did Y find?"])],
        }
    )
    chat = ScriptedLLM(
        {
            EvidenceGrade: [_grade(True)],
            DraftAnswer: [DRAFT],
            Verification: [Verification.model_validate({"checks": []})],
        }
    )
    retrieval = FakeRetrieval()

    result = await run_agents(build_graph(_deps(chat, fast, retrieval)), "Compare X and Y")

    # The standalone question plus each sub-question (the duplicate is searched once each).
    assert sorted(retrieval.queries) == sorted(
        ["What did X find?", "What did X find?", "What did Y find?"]
    )
    # No sentence verified -> nothing safe to say.
    assert result.abstained


async def test_chitchat_skips_retrieval_and_llm_answering() -> None:
    fast = ScriptedLLM({RouteDecision: [_route(route="chitchat")]})
    chat = ScriptedLLM({})
    retrieval = FakeRetrieval()

    result = await run_agents(build_graph(_deps(chat, fast, retrieval)), "hi!")

    assert result.answer == CHITCHAT_REPLY
    assert retrieval.queries == []
    assert sum(chat.calls.values()) == 0


async def test_stream_yields_steps_then_result() -> None:
    fast = ScriptedLLM({RouteDecision: [_route(route="out_of_scope")]})
    graph = build_graph(_deps(ScriptedLLM({}), fast, FakeRetrieval()))

    events = [event async for event in stream_agents(graph, "Best pizza in Rome?")]

    assert events[0] == {"agent": "router", "detail": "Route: out_of_scope"}
    assert isinstance(events[-1], AgentResult)
    assert events[-1].abstained


def test_grade_fails_when_any_specific_is_unmatched_even_if_marked_sufficient() -> None:
    grade = EvidenceGrade(
        specifics=["cannabidiol", "older adults"],
        unmatched_specifics=["cannabidiol"],
        sufficient=True,
        missing="",
        rewritten_query="",
    )
    assert not grade.passes
