import json
import logging
from collections.abc import AsyncIterator
from typing import Annotated, Any, Literal

import openai
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.agents.graph import AgentResult, run_agents, stream_agents
from app.agents.service import get_agent_graph
from app.api.limits import guard_chat
from app.llm.chat import BudgetExceededError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"], dependencies=[Depends(guard_chat)])


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: Annotated[str, Field(max_length=4000)]


class ChatRequest(BaseModel):
    question: Annotated[str, Field(min_length=1, max_length=1000)]
    history: Annotated[list[Message], Field(max_length=12)] = []


class Source(BaseModel):
    number: int
    title: str
    section: str
    arxiv_id: str | None
    url: str | None
    text: str


class ChatResponse(BaseModel):
    answer: str
    abstained: bool
    blocked: bool
    route: str
    sources: list[Source]
    verified_sentences: int
    removed_sentences: int
    corrective_searches: int
    steps: list[dict[str, str]]


def _response(result: AgentResult) -> ChatResponse:
    return ChatResponse(
        answer=result.answer,
        abstained=result.abstained,
        blocked=result.blocked,
        route=result.route,
        sources=[
            Source(
                number=number,
                title=passage.title,
                section=passage.section_path,
                arxiv_id=passage.external_id,
                url=passage.url,
                text=passage.text,
            )
            for number, passage in enumerate(result.passages, start=1)
        ],
        verified_sentences=result.verified_sentences,
        removed_sentences=result.removed_sentences,
        corrective_searches=result.retries,
        steps=[dict(step) for step in result.steps],
    )


def _history(request: ChatRequest) -> list[dict[str, str]]:
    return [message.model_dump() for message in request.history]


@router.post("/ask")
async def ask(request: ChatRequest) -> ChatResponse:
    """Answer a question (non-streaming). Same pipeline as /chat."""
    result = await run_agents(get_agent_graph(), request.question, _history(request))
    return _response(result)


def _user_message(error: Exception) -> str:
    """A safe, specific message for the UI. Never includes exception details."""
    if isinstance(error, BudgetExceededError):
        return "The demo's daily LLM budget is used up. Please try again tomorrow."
    if isinstance(error, openai.RateLimitError):
        return "The language model is rate limited right now. Please try again shortly."
    if isinstance(error, openai.APIStatusError | openai.APIConnectionError):
        return "The language model service is unavailable right now. Please try again."
    return "Something went wrong answering that. Please try again."


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    """Answer a question, streaming each agent step as Server-Sent Events.

    Events: `step` ({agent, detail}) as agents finish, then one `answer` (ChatResponse),
    or `error`. The answer is sent only after verification, never as unchecked tokens.
    """

    async def events() -> AsyncIterator[str]:
        try:
            async for event in stream_agents(
                get_agent_graph(), request.question, _history(request)
            ):
                if isinstance(event, AgentResult):
                    yield _sse("answer", _response(event).model_dump())
                else:
                    yield _sse("step", event)
        except Exception as error:
            logger.exception("Chat failed")
            yield _sse("error", {"error": _user_message(error), "type": type(error).__name__})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
