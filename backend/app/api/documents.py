import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Document, DocumentStatus
from app.db.session import get_session

router = APIRouter(prefix="/documents", tags=["documents"])
Session = Annotated[AsyncSession, Depends(get_session)]


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source: str
    external_id: str | None
    title: str
    authors: list[str]
    url: str | None
    published_at: datetime | None
    status: DocumentStatus
    error: str | None
    chunk_count: int
    created_at: datetime


class DocumentPage(BaseModel):
    items: list[DocumentOut]
    total: int
    status_counts: dict[str, int]


@router.get("")
async def list_documents(
    session: Session,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    status_filter: Annotated[DocumentStatus | None, Query(alias="status")] = None,
) -> DocumentPage:
    query = select(Document)
    if status_filter is not None:
        query = query.where(Document.status == status_filter)
    documents = await session.scalars(
        query.order_by(Document.created_at.desc()).limit(limit).offset(offset)
    )
    counts = dict(
        (row.status.value, row.count)
        for row in await session.execute(
            select(Document.status, func.count().label("count")).group_by(Document.status)
        )
    )
    total = counts.get(status_filter.value, 0) if status_filter else sum(counts.values())
    return DocumentPage(
        items=[DocumentOut.model_validate(document) for document in documents],
        total=total,
        status_counts=counts,
    )


@router.get("/{document_id}")
async def get_document(document_id: uuid.UUID, session: Session) -> DocumentOut:
    document = await session.get(Document, document_id)
    if document is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return DocumentOut.model_validate(document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: uuid.UUID, session: Session) -> None:
    # Chunks are removed by the ON DELETE CASCADE foreign key.
    result = await session.execute(delete(Document).where(Document.id == document_id))
    if not result.rowcount:  # type: ignore[attr-defined]
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    await session.commit()
