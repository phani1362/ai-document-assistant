import secrets
from typing import Annotated

from fastapi import Header, HTTPException, status

from app.config import get_settings


def require_admin(x_admin_token: Annotated[str | None, Header()] = None) -> None:
    """Guard for destructive endpoints. With no ADMIN_TOKEN configured, they are disabled."""
    expected = get_settings().admin_token
    if not expected or not x_admin_token or not secrets.compare_digest(x_admin_token, expected):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin token required")
