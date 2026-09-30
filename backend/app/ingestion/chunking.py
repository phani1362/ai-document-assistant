"""Structure-aware, parent-child chunking of Markdown.

Sections (from headings) are never mixed. Each section is packed into *parent* chunks
that are handed to the LLM as context, and each parent is split into small, overlapping
*child* chunks that are embedded and searched. Small children match queries precisely;
large parents give the answer enough surrounding context.

Splits fall back from paragraph -> sentence -> token window, so text is only cut
mid-sentence when a single sentence is longer than a chunk. Tables are split by rows
with the header repeated, so every piece of a table is still readable on its own.
"""

import hashlib
import re
from dataclasses import dataclass, field
from functools import lru_cache

import tiktoken

_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
_SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+(?=[\"'(\[]?[A-Z0-9])")
PATH_SEPARATOR = " > "


@lru_cache
def _encoding() -> tiktoken.Encoding:
    # cl100k is not Gemini's tokenizer, but it tracks it closely enough to size chunks.
    return tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    return len(_encoding().encode(text, disallowed_special=()))


def content_hash(text: str) -> str:
    return hashlib.sha256(" ".join(text.split()).encode()).hexdigest()


@dataclass(frozen=True)
class Section:
    path: tuple[str, ...]
    body: str


@dataclass
class ChunkDraft:
    index: int
    section_path: str
    text: str
    token_count: int
    content_hash: str


@dataclass
class ParentDraft(ChunkDraft):
    children: list[ChunkDraft] = field(default_factory=list)


@dataclass(frozen=True)
class _Unit:
    """A piece of text that is never split further, plus how it joins its predecessor."""

    text: str
    tokens: int
    joiner: str
    is_table: bool = False


def split_sections(markdown: str) -> list[Section]:
    sections: list[Section] = []
    stack: list[tuple[int, str]] = []
    body: list[str] = []

    def flush() -> None:
        text = "\n".join(body).strip()
        if text:
            sections.append(Section(tuple(title for _, title in stack), text))
        body.clear()

    for line in markdown.replace("\r\n", "\n").split("\n"):
        match = _HEADING.match(line)
        if match:
            flush()
            level = len(match.group(1))
            while stack and stack[-1][0] >= level:
                stack.pop()
            stack.append((level, match.group(2).strip()))
        else:
            body.append(line)
    flush()
    return sections


def _blocks(body: str) -> list[str]:
    return [block.strip() for block in re.split(r"\n\s*\n", body) if block.strip()]


def _is_table(block: str) -> bool:
    lines = block.splitlines()
    return len(lines) >= 2 and all(line.lstrip().startswith("|") for line in lines)


def _token_windows(text: str, size: int) -> list[str]:
    tokens = _encoding().encode(text, disallowed_special=())
    return [_encoding().decode(tokens[i : i + size]).strip() for i in range(0, len(tokens), size)]


def _table_units(block: str, limit: int) -> list[_Unit]:
    lines = block.splitlines()
    header = "\n".join(lines[:2])
    header_tokens = count_tokens(header)
    units: list[_Unit] = []
    rows: list[str] = []
    rows_tokens = header_tokens
    for row in lines[2:]:
        row_tokens = count_tokens(row) + 1
        if rows and rows_tokens + row_tokens > limit:
            text = header + "\n" + "\n".join(rows)
            units.append(_Unit(text, count_tokens(text), "\n\n", is_table=True))
            rows, rows_tokens = [], header_tokens
        rows.append(row)
        rows_tokens += row_tokens
    if rows:
        text = header + "\n" + "\n".join(rows)
        units.append(_Unit(text, count_tokens(text), "\n\n", is_table=True))
    return units


def _units(block: str, limit: int) -> list[_Unit]:
    """Break one block into units no larger than `limit` tokens, preferring big units."""
    tokens = count_tokens(block)
    if tokens <= limit:
        return [_Unit(block, tokens, "\n\n", is_table=_is_table(block))]
    if _is_table(block):
        return _table_units(block, limit)

    units: list[_Unit] = []
    for sentence in _SENTENCE_BOUNDARY.split(block):
        sentence = sentence.strip()
        if not sentence:
            continue
        sentence_tokens = count_tokens(sentence)
        pieces = [sentence] if sentence_tokens <= limit else _token_windows(sentence, limit)
        for piece in pieces:
            joiner = "\n\n" if not units else " "
            units.append(_Unit(piece, count_tokens(piece), joiner))
    return units


def _pack(units: list[_Unit], limit: int, overlap: int = 0) -> list[str]:
    """Greedily pack units into chunks of at most `limit` tokens.

    With `overlap`, each new chunk starts with the trailing prose units of the previous
    chunk (up to `overlap` tokens), so a fact that straddles a boundary is not lost.
    """
    chunks: list[str] = []
    current: list[_Unit] = []
    current_tokens = 0

    def render(group: list[_Unit]) -> str:
        return "".join(unit.joiner + unit.text if i else unit.text for i, unit in enumerate(group))

    for unit in units:
        if current and current_tokens + unit.tokens > limit:
            chunks.append(render(current))
            carried: list[_Unit] = []
            carried_tokens = 0
            for previous in reversed(current):
                if previous.is_table or carried_tokens + previous.tokens > overlap:
                    break
                carried.insert(0, previous)
                carried_tokens += previous.tokens
            if carried_tokens + unit.tokens > limit:
                carried, carried_tokens = [], 0
            current, current_tokens = carried, carried_tokens
        current.append(unit)
        current_tokens += unit.tokens
    if current:
        chunks.append(render(current))
    return chunks


def chunk_markdown(
    markdown: str,
    *,
    child_tokens: int = 350,
    child_overlap: int = 50,
    parent_tokens: int = 1200,
) -> list[ParentDraft]:
    """Split Markdown into parent chunks, each holding its child chunks."""
    parents: list[ParentDraft] = []
    seen_parents: set[str] = set()
    seen_children: set[str] = set()
    child_index = 0

    for section in split_sections(markdown):
        path = PATH_SEPARATOR.join(section.path)
        blocks = _blocks(section.body)
        parent_units = [unit for block in blocks for unit in _units(block, parent_tokens)]

        for parent_text in _pack(parent_units, parent_tokens):
            parent_hash = content_hash(path + parent_text)
            if parent_hash in seen_parents:
                continue
            seen_parents.add(parent_hash)
            parent = ParentDraft(
                index=len(parents),
                section_path=path,
                text=parent_text,
                token_count=count_tokens(parent_text),
                content_hash=parent_hash,
            )
            child_units = [
                unit for block in _blocks(parent_text) for unit in _units(block, child_tokens)
            ]
            for child_text in _pack(child_units, child_tokens, child_overlap):
                child_hash = content_hash(path + child_text)
                if child_hash in seen_children:
                    continue
                seen_children.add(child_hash)
                parent.children.append(
                    ChunkDraft(
                        index=child_index,
                        section_path=path,
                        text=child_text,
                        token_count=count_tokens(child_text),
                        content_hash=child_hash,
                    )
                )
                child_index += 1
            parents.append(parent)
    return parents


def embedding_input(title: str, section_path: str, text: str) -> str:
    """Prefix a chunk with where it came from, so its embedding carries that context.

    A child such as "We set k=5." means little alone; with "Paper X > Experiments"
    in front, it can match "what k did Paper X use in its experiments?".
    """
    header = PATH_SEPARATOR.join(part for part in (title, section_path) if part)
    return f"{header}\n\n{text}" if header else text
