"""Convert source documents into Markdown, the single format the chunker understands.

Markdown keeps the document's heading hierarchy, which drives section-aware chunking,
and it is easy to inspect when debugging retrieval.
"""

import re

from bs4 import BeautifulSoup, Tag
from bs4.element import NavigableString

# LaTeXML (which renders arXiv HTML) marks each heading level with a class.
_SECTION_LEVELS = {
    "ltx_section": 2,
    "ltx_appendix": 2,
    "ltx_subsection": 3,
    "ltx_subsubsection": 4,
    "ltx_paragraph": 5,
}
# Parts of the page that add noise to retrieval rather than content.
_DROP_SELECTORS = [
    ".ltx_bibliography",
    ".ltx_authors",
    ".ltx_page_navbar",
    ".ltx_TOC",
    ".ltx_note",
    ".ltx_page_footer",
    ".ltx_dates",
    "header",
    "footer",
    "nav",
    "script",
    "style",
]


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _classes(tag: Tag) -> list[str]:
    value = tag.get("class")
    return value if isinstance(value, list) else []


def _table_to_markdown(table: Tag) -> str:
    rows: list[list[str]] = []
    for row in table.find_all("tr"):
        # Skip rows of tables nested inside a cell; the cell's text already covers them.
        if row.find_parent("table") is not table:
            continue
        cells = [
            _clean(cell.get_text(" ")).replace("|", "\\|")
            for cell in row.find_all(["td", "th"])
            if cell.find_parent("tr") is row
        ]
        if any(cells):
            rows.append(cells)
    if not rows:
        return ""
    width = max(len(row) for row in rows)
    lines = ["| " + " | ".join(row + [""] * (width - len(row))) + " |" for row in rows]
    lines.insert(1, "|" + " --- |" * width)
    return "\n".join(lines)


def _caption(figure: Tag) -> str:
    caption = figure.find(class_="ltx_caption")
    return _clean(caption.get_text(" ")) if caption else ""


def _render_block(node: Tag, out: list[str]) -> None:
    """Append Markdown blocks for one non-section element."""
    classes = _classes(node)
    if node.name == "figure" and "ltx_table" in classes:
        caption = _caption(node)
        if caption:
            out.append(caption)
        for table in node.find_all("table", class_="ltx_tabular"):
            if table.find_parent("table", class_="ltx_tabular") is None:
                markdown = _table_to_markdown(table)
                if markdown:
                    out.append(markdown)
    elif node.name == "figure":
        caption = _caption(node)
        if caption:
            out.append(caption)
    elif node.name in ("ul", "ol"):
        items = [_clean(item.get_text(" ")) for item in node.find_all("li", recursive=False)]
        out.append("\n".join(f"- {item}" for item in items if item))
    elif node.name == "table" and "ltx_equation" in " ".join(classes):
        out.append(_clean(node.get_text(" ")))
    elif node.name == "p":
        text = _clean(node.get_text(" "))
        if text:
            out.append(text)
    else:
        children = [child for child in node.children if isinstance(child, Tag)]
        if children:
            for child in children:
                _render_block(child, out)
        else:
            text = _clean(node.get_text(" "))
            if text:
                out.append(text)


def _render_section(section: Tag, level: int, out: list[str]) -> None:
    for child in section.children:
        if not isinstance(child, Tag):
            continue
        child_classes = _classes(child)
        if "ltx_title" in child_classes and child.name and child.name.startswith("h"):
            out.append(f"{'#' * level} {_clean(child.get_text(' '))}")
            continue
        child_level = next(
            (_SECTION_LEVELS[c] for c in child_classes if c in _SECTION_LEVELS), None
        )
        if child_level is not None:
            _render_section(child, child_level, out)
        else:
            _render_block(child, out)


def parse_arxiv_html(html: str) -> tuple[str, str]:
    """Return (title, markdown body) for an arXiv HTML (LaTeXML) paper."""
    soup = BeautifulSoup(html, "lxml")
    article = soup.find("article", class_="ltx_document")
    if not isinstance(article, Tag):
        raise ValueError("Not an arXiv LaTeXML document: missing <article class='ltx_document'>")

    for selector in _DROP_SELECTORS:
        for element in article.select(selector):
            element.decompose()
    # Keep math as LaTeX so formulas stay searchable and readable by the LLM.
    for math in article.find_all("math"):
        alttext = math.get("alttext")
        math.replace_with(NavigableString(f" ${alttext}$ " if isinstance(alttext, str) else " "))

    title_tag = article.find(class_="ltx_title_document")
    title = _clean(title_tag.get_text(" ")) if title_tag else ""
    if title_tag:
        title_tag.decompose()

    out: list[str] = []
    abstract = article.find(class_="ltx_abstract")
    if isinstance(abstract, Tag):
        out.append("## Abstract")
        for paragraph in abstract.find_all("p"):
            text = _clean(paragraph.get_text(" "))
            if text:
                out.append(text)
        abstract.decompose()

    _render_section(article, 2, out)
    return title, "\n\n".join(block for block in out if block.strip())
