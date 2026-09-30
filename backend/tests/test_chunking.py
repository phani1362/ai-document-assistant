from app.ingestion.chunking import (
    chunk_markdown,
    embedding_input,
    split_sections,
)


def _sentences(prefix: str, count: int) -> str:
    return " ".join(f"{prefix} sentence number {i} describes one detail." for i in range(count))


def test_split_sections_tracks_heading_hierarchy() -> None:
    markdown = "## Intro\n\nHello.\n\n## Method\n\n### Retriever\n\nDense.\n\n### Reader\n\nLLM."

    sections = split_sections(markdown)

    assert [section.path for section in sections] == [
        ("Intro",),
        ("Method", "Retriever"),
        ("Method", "Reader"),
    ]
    assert sections[1].body == "Dense."


def test_chunks_never_mix_sections() -> None:
    markdown = f"## A\n\n{_sentences('Alpha', 40)}\n\n## B\n\n{_sentences('Beta', 40)}"

    parents = chunk_markdown(markdown, child_tokens=80, child_overlap=0, parent_tokens=300)

    for parent in parents:
        for child in parent.children:
            assert child.section_path == parent.section_path
            other = "Beta" if parent.section_path == "A" else "Alpha"
            assert other not in child.text


def test_children_respect_token_limit_and_parents_group_them() -> None:
    markdown = "## Long\n\n" + "\n\n".join(_sentences(f"P{i}", 6) for i in range(30))

    parents = chunk_markdown(markdown, child_tokens=120, child_overlap=20, parent_tokens=500)

    assert len(parents) > 1
    for parent in parents:
        assert parent.token_count <= 500
        assert parent.children
        for child in parent.children:
            assert child.token_count <= 120
    indexes = [child.index for parent in parents for child in parent.children]
    assert indexes == list(range(len(indexes)))


def test_consecutive_children_overlap() -> None:
    markdown = "## S\n\n" + _sentences("Gamma", 60)

    [parent] = chunk_markdown(markdown, child_tokens=100, child_overlap=30, parent_tokens=2000)

    first, second = parent.children[0], parent.children[1]
    last_sentence_of_first = first.text.rsplit(". ", 1)[-1]
    assert last_sentence_of_first in second.text
    assert not second.text.startswith(first.text[:40])


def test_long_table_is_split_by_rows_with_header_repeated() -> None:
    header = "| Model | Dataset | Score |\n| --- | --- | --- |"
    rows = "\n".join(f"| model-{i} | dataset-{i} | {i}.0 |" for i in range(80))
    markdown = f"## Results\n\n{header}\n{rows}"

    [parent] = chunk_markdown(markdown, child_tokens=150, child_overlap=30, parent_tokens=5000)

    assert len(parent.children) > 1
    for child in parent.children:
        assert child.text.startswith(header)
        assert child.token_count <= 150


def test_oversized_sentence_is_split_by_token_windows() -> None:
    markdown = "## S\n\n" + " ".join(f"word{i}" for i in range(1000))

    [parent] = chunk_markdown(markdown, child_tokens=100, child_overlap=0, parent_tokens=2000)

    assert all(child.token_count <= 100 for child in parent.children)
    assert len(parent.children) > 1
    assert "word999" in parent.children[-1].text


def test_duplicate_blocks_in_a_section_are_embedded_once() -> None:
    boilerplate = "This paper is licensed under CC BY 4.0."
    markdown = f"## A\n\n{boilerplate}\n\n## A\n\n{boilerplate}"

    parents = chunk_markdown(markdown)

    assert sum(len(parent.children) for parent in parents) == 1


def test_embedding_input_prefixes_title_and_section() -> None:
    text = embedding_input("Attention Is All You Need", "Training > Optimizer", "We used Adam.")

    assert text == "Attention Is All You Need > Training > Optimizer\n\nWe used Adam."
