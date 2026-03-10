from __future__ import annotations

from pathlib import Path
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api import deps
from app.core.config import settings
from app.db.models import RoleEnum, User

router = APIRouter()


class ReleaseLogItem(BaseModel):
    timestamp: str
    action: Optional[str] = None
    ref: Optional[str] = None
    actor: Optional[str] = None
    status: Optional[str] = None
    message: Optional[str] = None


class UpdateStatusResponse(BaseModel):
    environment: str
    state_file: str
    releases_log_file: str
    current_ref: Optional[str] = None
    previous_ref: Optional[str] = None
    last_deploy_at: Optional[str] = None
    last_status: Optional[str] = None
    last_error: Optional[str] = None
    last_action: Optional[str] = None
    last_actor: Optional[str] = None
    releases: List[ReleaseLogItem] = []


def _parse_state_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}

    parsed: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        value = value.replace("\\ ", " ")
        parsed[key.strip()] = value
    return parsed


def _parse_releases(path: Path, limit: int = 20) -> list[ReleaseLogItem]:
    if not path.exists():
        return []

    rows = [ln.strip() for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]
    tail = rows[-limit:]
    parsed: list[ReleaseLogItem] = []

    for line in reversed(tail):
        parts = line.split("\t")
        if not parts:
            continue

        item: dict[str, str | None] = {
            "timestamp": parts[0],
            "action": None,
            "ref": None,
            "actor": None,
            "status": None,
            "message": None,
        }

        for part in parts[1:]:
            if "=" not in part:
                continue
            key, value = part.split("=", 1)
            if key in item:
                item[key] = value

        parsed.append(ReleaseLogItem(**item))

    return parsed


@router.get("/update-status", response_model=UpdateStatusResponse)
async def get_update_status(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    allowed_roles = {RoleEnum.NETWORK_ADMIN, RoleEnum.SALON_ADMIN, RoleEnum.OPERATOR}
    if current_user.global_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Недостатньо прав")

    state_path = Path(settings.DEPLOY_STATE_FILE)
    releases_path = Path(settings.DEPLOY_RELEASES_LOG)

    state = _parse_state_file(state_path)
    releases = _parse_releases(releases_path)

    return UpdateStatusResponse(
        environment=settings.ENVIRONMENT,
        state_file=str(state_path),
        releases_log_file=str(releases_path),
        current_ref=state.get("CURRENT_REF") or None,
        previous_ref=state.get("PREVIOUS_REF") or None,
        last_deploy_at=state.get("LAST_DEPLOY_AT") or None,
        last_status=state.get("LAST_STATUS") or None,
        last_error=state.get("LAST_ERROR") or None,
        last_action=state.get("LAST_ACTION") or None,
        last_actor=state.get("LAST_ACTOR") or None,
        releases=releases,
    )
