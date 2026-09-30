from app.ingestion.arxiv import parse_feed
from app.ingestion.parsers import parse_arxiv_html

ARXIV_HTML = """
<html><body><article class="ltx_document">
  <h1 class="ltx_title ltx_title_document">Sparse Retrieval Revisited</h1>
  <div class="ltx_authors"><span class="ltx_personname">A. Author</span></div>
  <div class="ltx_abstract"><h6 class="ltx_title">Abstract</h6>
    <p class="ltx_p">We revisit BM25.</p></div>
  <section class="ltx_section">
    <h2 class="ltx_title ltx_title_section">1 Method</h2>
    <div class="ltx_para"><p class="ltx_p">Scores use
      <math alttext="k_{1}=1.2"><mi>k</mi></math> as saturation.<span class="ltx_note">
      footnote noise</span></p></div>
    <section class="ltx_subsection">
      <h3 class="ltx_title ltx_title_subsection">1.1 Results</h3>
      <figure class="ltx_table"><figcaption class="ltx_caption">Table 1: Recall</figcaption>
        <table class="ltx_tabular">
          <tr><td>Model</td><td>R@10</td></tr>
          <tr><td>BM25</td><td>0.61</td></tr>
        </table></figure>
    </section>
  </section>
  <section class="ltx_bibliography"><h2>References</h2><p>[1] Citation noise.</p></section>
</article></body></html>
"""


def test_parse_arxiv_html_keeps_structure_and_drops_noise() -> None:
    title, markdown = parse_arxiv_html(ARXIV_HTML)

    assert title == "Sparse Retrieval Revisited"
    assert markdown == (
        "## Abstract\n\n"
        "We revisit BM25.\n\n"
        "## 1 Method\n\n"
        "Scores use $k_{1}=1.2$ as saturation.\n\n"
        "### 1.1 Results\n\n"
        "Table 1: Recall\n\n"
        "| Model | R@10 |\n| --- | --- |\n| BM25 | 0.61 |"
    )


def test_parse_arxiv_html_rejects_non_latexml_pages() -> None:
    try:
        parse_arxiv_html("<html><body>No HTML for this paper.</body></html>")
    except ValueError:
        return
    raise AssertionError("expected ValueError")


def test_parse_feed_reads_atom_entries() -> None:
    feed = """<feed xmlns="http://www.w3.org/2005/Atom"><entry>
      <id>http://arxiv.org/abs/2312.10997v5</id>
      <published>2023-12-18T07:47:33Z</published>
      <title>Retrieval-Augmented Generation for
        Large Language Models: A Survey</title>
      <summary>  Large language models   hallucinate. </summary>
      <author><name>Yunfan Gao</name></author><author><name>Yun Xiong</name></author>
      <category term="cs.CL"/><category term="cs.AI"/>
    </entry></feed>"""

    [paper] = parse_feed(feed)

    assert paper.arxiv_id == "2312.10997"
    assert paper.title == "Retrieval-Augmented Generation for Large Language Models: A Survey"
    assert paper.authors == ["Yunfan Gao", "Yun Xiong"]
    assert paper.abstract == "Large language models hallucinate."
    assert paper.categories == ["cs.CL", "cs.AI"]
    assert paper.url == "https://arxiv.org/abs/2312.10997"
