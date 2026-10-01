"""Multi-agent RAG as a LangGraph state machine.

router -> [planner] -> retrieve (parallel per query) -> assemble -> grader
    -> (corrective retrieve, once) -> synthesizer -> verifier -> END

Each agent is one LLM call with a structured output, so every decision (route, evidence
grade, per-sentence verification) is inspectable, testable, and streamed to the UI.
Dependencies are injected so the graph runs in tests without a database or network.
"""

import operator
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass, field
from typing import Annotated, Any, Literal, TypedDict, cast

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Send

from app.agents.prompts import (
    GRADER_SYSTEM,
    PLANNER_SYSTEM,
    ROUTER_SYSTEM,
    SYNTHESIZER_SYSTEM,
    VERIFIER_SYSTEM,
    DraftAnswer,
    EvidenceGrade,
    RouteDecision,
    SubQuestions,
    Verification,
)
from app.llm.chat import LLM
from app.rag.baseline import ABSTAIN_MESSAGE, format_sources
from app.retrieval.search import ContextPassage, RetrievedChunk

MAX_CORRECTIVE_RETRIES = 1
CHITCHAT_REPLY = (
    "Hi! I answer questions about ~200 research papers on retrieval-augmented generation, "
    "with citations to the exact sections I used. Try asking about a method, benchmark, "
    "or result."
)
OUT_OF_SCOPE_REPLY = (
    "I can only answer questions about the indexed research papers on retrieval-augmented "
    "generation, LLMs, and information retrieval."
)

Retrieve = Callable[[str, int], Awaitable[list[RetrievedChunk]]]
LoadPassages = Callable[[list[RetrievedChunk]], Awaitable[list[ContextPassage]]]


@dataclass
class AgentDeps:
    chat_llm: LLM
    fast_llm: LLM
    retrieve: Retrieve
    load_passages: LoadPassages
    top_k: int = 5
    max_passages: int = 8


class Step(TypedDict):
    agent: str
    detail: str


class AgentState(TypedDict, total=False):
    question: str
    history: list[dict[str, str]]
    route: str
    standalone_question: str
    queries: list[str]
    # Accumulates across parallel and corrective retrievals.
    retrieved: Annotated[list[RetrievedChunk], operator.add]
    passages: list[ContextPassage]
    grade: EvidenceGrade
    retries: int
    draft: DraftAnswer
    answer: str
    abstained: bool
    verified_sentences: int
    removed_sentences: int
    steps: Annotated[list[Step], operator.add]


class RetrieveTask(TypedDict):
    query: str


def _step(agent: str, detail: str) -> list[Step]:
    return [{"agent": agent, "detail": detail}]


def _merge(chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
    """Dedupe chunks from several searches, best reranker score first."""
    best: dict[Any, RetrievedChunk] = {}
    for chunk in chunks:
        if chunk.chunk_id not in best or chunk.score > best[chunk.chunk_id].score:
            best[chunk.chunk_id] = chunk
    # sorted() is stable: equal scores keep the order the searches returned them in.
    return sorted(best.values(), key=lambda chunk: -chunk.score)


def _render(draft: DraftAnswer, keep: set[int], source_count: int) -> str:
    sentences = []
    for number, sentence in enumerate(draft.sentences, start=1):
        if number not in keep:
            continue
        cited = sorted({s for s in sentence.sources if 1 <= s <= source_count})
        sentences.append(sentence.text.strip() + "".join(f" [{s}]" for s in cited))
    return " ".join(sentences)


def build_graph(deps: AgentDeps) -> CompiledStateGraph[Any, Any, Any, Any]:
    async def router(state: AgentState) -> dict[str, Any]:
        history = "\n".join(f"{m['role']}: {m['content']}" for m in state.get("history", [])[-6:])
        decision = await deps.fast_llm.generate(
            f"Conversation so far:\n{history or '(none)'}\n\nLatest message: {state['question']}",
            system=ROUTER_SYSTEM,
            schema=RouteDecision,
        )
        update: dict[str, Any] = {
            "route": decision.route,
            "standalone_question": decision.standalone_question or state["question"],
            "queries": [decision.standalone_question or state["question"]],
            "retries": 0,
            "steps": _step("router", f"Route: {decision.route}"),
        }
        if decision.route == "research" and decision.needs_decomposition:
            update["route"] = "decompose"
        return update

    async def planner(state: AgentState) -> dict[str, Any]:
        plan = await deps.fast_llm.generate(
            state["standalone_question"], system=PLANNER_SYSTEM, schema=SubQuestions
        )
        queries = [state["standalone_question"], *plan.sub_questions[:3]]
        return {
            "queries": queries,
            "steps": _step("planner", "Split into: " + " | ".join(plan.sub_questions[:3])),
        }

    async def retrieve(task: RetrieveTask) -> dict[str, Any]:
        chunks = await deps.retrieve(task["query"], deps.top_k)
        return {
            "retrieved": chunks,
            "steps": _step("retriever", f"Searched: {task['query']} ({len(chunks)} hits)"),
        }

    async def assemble(state: AgentState) -> dict[str, Any]:
        merged = _merge(state["retrieved"])
        passages = (await deps.load_passages(merged))[: deps.max_passages]
        return {
            "passages": passages,
            "steps": _step("assembler", f"{len(passages)} source sections from {len(merged)} hits"),
        }

    async def grader(state: AgentState) -> dict[str, Any]:
        grade = await deps.chat_llm.generate(
            f"Question: {state['standalone_question']}\n\n"
            f"Sources:\n\n{format_sources(state['passages'])}",
            system=GRADER_SYSTEM,
            schema=EvidenceGrade,
        )
        if grade.passes:
            detail = "Evidence sufficient"
        elif grade.unmatched_specifics:
            detail = "Sources don't cover: " + ", ".join(grade.unmatched_specifics)
        else:
            detail = f"Evidence insufficient: {grade.missing}"
        return {"grade": grade, "steps": _step("grader", detail)}

    async def synthesizer(state: AgentState) -> dict[str, Any]:
        draft = await deps.chat_llm.generate(
            f"Sources:\n\n{format_sources(state['passages'])}\n\n"
            f"Question: {state['standalone_question']}",
            system=SYNTHESIZER_SYSTEM,
            schema=DraftAnswer,
        )
        return {
            "draft": draft,
            "steps": _step("synthesizer", f"Drafted {len(draft.sentences)} sentences"),
        }

    async def verifier(state: AgentState) -> dict[str, Any]:
        draft, passages = state["draft"], state["passages"]
        numbered = "\n".join(
            f"{number}. {sentence.text} (cites {sentence.sources})"
            for number, sentence in enumerate(draft.sentences, start=1)
        )
        verification = await deps.chat_llm.generate(
            f"Sources:\n\n{format_sources(passages)}\n\nAnswer sentences:\n{numbered}",
            system=VERIFIER_SYSTEM,
            schema=Verification,
        )
        supported = {c.sentence for c in verification.checks if c.supported}
        removed = len(draft.sentences) - len(supported & set(range(1, len(draft.sentences) + 1)))
        answer = _render(draft, supported, len(passages))
        abstained = not answer
        return {
            "answer": answer or ABSTAIN_MESSAGE,
            "abstained": abstained,
            "verified_sentences": len(draft.sentences) - removed,
            "removed_sentences": removed,
            "steps": _step(
                "verifier",
                f"{len(draft.sentences) - removed}/{len(draft.sentences)} sentences supported"
                + (f"; removed {removed}" if removed else ""),
            ),
        }

    async def abstain(state: AgentState) -> dict[str, Any]:
        grade = state.get("grade")
        found = {p.title for p in state.get("passages", [])}
        reason = f" {grade.missing}" if grade and grade.missing else ""
        closest = f" The closest papers I found: {'; '.join(sorted(found)[:3])}." if found else ""
        return {
            "answer": f"{ABSTAIN_MESSAGE}{reason}{closest}",
            "abstained": True,
            "steps": _step("abstain", "Declined: the sources do not support an answer"),
        }

    async def canned(state: AgentState) -> dict[str, Any]:
        reply = CHITCHAT_REPLY if state["route"] == "chitchat" else OUT_OF_SCOPE_REPLY
        return {"answer": reply, "abstained": state["route"] == "out_of_scope", "passages": []}

    def after_router(state: AgentState) -> Literal["planner", "canned"] | list[Send]:
        if state["route"] in ("chitchat", "out_of_scope"):
            return "canned"
        if state["route"] == "decompose":
            return "planner"
        return [Send("retrieve", {"query": state["queries"][0]})]

    def fan_out(state: AgentState) -> list[Send]:
        return [Send("retrieve", {"query": query}) for query in state["queries"]]

    def after_grade(state: AgentState) -> Literal["synthesizer", "abstain"] | list[Send]:
        grade = state["grade"]
        if grade.passes:
            return "synthesizer"
        if state.get("retries", 0) < MAX_CORRECTIVE_RETRIES and grade.rewritten_query:
            return [Send("corrective_retrieve", {"query": grade.rewritten_query})]
        return "abstain"

    async def corrective_retrieve(task: RetrieveTask) -> dict[str, Any]:
        update = await retrieve(task)
        # Only one corrective round, so retries goes 0 -> 1 here.
        return {**update, "retries": MAX_CORRECTIVE_RETRIES}

    graph = StateGraph(AgentState)
    graph.add_node("router", router)
    graph.add_node("planner", planner)
    # Retrieval nodes receive a RetrieveTask from Send(), not the full graph state.
    graph.add_node("retrieve", retrieve, input_schema=RetrieveTask)  # type: ignore[arg-type]
    graph.add_node(
        "corrective_retrieve",
        corrective_retrieve,  # type: ignore[arg-type]
        input_schema=RetrieveTask,
    )
    graph.add_node("assemble", assemble)
    graph.add_node("grader", grader)
    graph.add_node("synthesizer", synthesizer)
    graph.add_node("verifier", verifier)
    graph.add_node("abstain", abstain)
    graph.add_node("canned", canned)

    graph.add_edge(START, "router")
    graph.add_conditional_edges("router", after_router, ["planner", "canned", "retrieve"])
    graph.add_conditional_edges("planner", fan_out, ["retrieve"])
    graph.add_edge("retrieve", "assemble")
    graph.add_edge("corrective_retrieve", "assemble")
    graph.add_edge("assemble", "grader")
    graph.add_conditional_edges(
        "grader", after_grade, ["synthesizer", "abstain", "corrective_retrieve"]
    )
    graph.add_edge("synthesizer", "verifier")
    graph.add_edge("verifier", END)
    graph.add_edge("abstain", END)
    graph.add_edge("canned", END)
    return graph.compile()


@dataclass
class AgentResult:
    answer: str
    abstained: bool
    route: str
    passages: list[ContextPassage]
    retrieved: list[RetrievedChunk]
    steps: list[Step]
    verified_sentences: int = 0
    removed_sentences: int = 0
    retries: int = 0
    extra: dict[str, Any] = field(default_factory=dict)


def _result(state: dict[str, Any]) -> AgentResult:
    return AgentResult(
        answer=state.get("answer", ABSTAIN_MESSAGE),
        abstained=state.get("abstained", False),
        route=state.get("route", ""),
        passages=state.get("passages", []),
        retrieved=_merge(state.get("retrieved", [])),
        steps=state.get("steps", []),
        verified_sentences=state.get("verified_sentences", 0),
        removed_sentences=state.get("removed_sentences", 0),
        retries=state.get("retries", 0),
    )


async def run_agents(
    graph: CompiledStateGraph[Any, Any, Any, Any],
    question: str,
    history: list[dict[str, str]] | None = None,
) -> AgentResult:
    state = await graph.ainvoke({"question": question, "history": history or []})
    return _result(state)


async def stream_agents(
    graph: CompiledStateGraph[Any, Any, Any, Any],
    question: str,
    history: list[dict[str, str]] | None = None,
) -> AsyncIterator[Step | AgentResult]:
    """Yield each agent step as it completes, then the final result."""
    final: dict[str, Any] = {}
    async for mode, chunk in graph.astream(
        {"question": question, "history": history or []}, stream_mode=["updates", "values"]
    ):
        if mode == "updates":
            for update in cast(dict[str, dict[str, Any] | None], chunk).values():
                for step in (update or {}).get("steps", []):
                    yield step
        else:
            final = cast(dict[str, Any], chunk)
    yield _result(final)
