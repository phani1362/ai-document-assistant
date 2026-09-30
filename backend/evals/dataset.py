from pathlib import Path
from typing import Literal

from pydantic import BaseModel

DATASETS_DIR = Path(__file__).parent / "datasets"
DEFAULT_DATASET = DATASETS_DIR / "golden.jsonl"


class EvalItem(BaseModel):
    id: str
    question: str
    answerable: bool
    reference_answer: str
    # Verbatim quotes from the source that contain the answer. A retrieved chunk is
    # relevant if it contains one. Matching on text (not chunk IDs) keeps the dataset
    # valid when chunk sizes or strategies change between experiments.
    evidence: list[str]
    source_external_id: str | None
    source_title: str
    kind: Literal["factual", "unanswerable"]


def load_dataset(path: Path = DEFAULT_DATASET) -> list[EvalItem]:
    return [
        EvalItem.model_validate_json(line) for line in path.read_text().splitlines() if line.strip()
    ]


def save_dataset(items: list[EvalItem], path: Path = DEFAULT_DATASET) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(item.model_dump_json() + "\n" for item in items))
