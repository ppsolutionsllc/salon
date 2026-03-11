from __future__ import annotations

import hashlib
import os
import secrets
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Optional

from fastapi import (
    APIRouter,
    Depends,
    File as FastAPIFile,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
)
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core.config import settings
from app.db.database import get_db
from app.db.models import (
    AuditLog,
    File as DBFile,
    Page,
    PageVersion,
    PreviewToken,
    RoleEnum,
    Salon,
    User,
    UserSalonAccess,
)

router = APIRouter()


READ_ROLES = {RoleEnum.NETWORK_ADMIN, RoleEnum.SALON_ADMIN, RoleEnum.OPERATOR}
WRITE_ROLES = {RoleEnum.NETWORK_ADMIN, RoleEnum.SALON_ADMIN}
ALLOWED_BLOCK_TYPES = {
    "hero",
    "rich_text",
    "features",
    "services_teaser",
    "masters_teaser",
    "before_after",
    "testimonials",
    "branches",
    "faq",
}


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_slug(value: str) -> str:
    raw = (value or "").strip().lower()
    if not raw:
        raise HTTPException(status_code=422, detail="Слаг сторінки обов'язковий")
    cleaned = []
    for ch in raw:
        if ch.isalnum() or ch in {"-", "_"}:
            cleaned.append(ch)
        elif ch in {" ", "/"}:
            cleaned.append("-")
    out = "".join(cleaned).strip("-")
    if not out:
        raise HTTPException(status_code=422, detail="Некоректний слаг сторінки")
    return out[:120]


def _preview_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _validate_content_json(content: list[dict[str, Any]]) -> None:
    if not isinstance(content, list):
        raise HTTPException(status_code=422, detail="content_json має бути масивом блоків")

    for idx, block in enumerate(content):
        if not isinstance(block, dict):
            raise HTTPException(status_code=422, detail=f"Блок #{idx + 1} має бути об'єктом")
        block_type = block.get("type")
        block_id = block.get("id")
        props = block.get("props")
        if not block_type or not isinstance(block_type, str):
            raise HTTPException(status_code=422, detail=f"Блок #{idx + 1}: type обов'язковий")
        if block_type not in ALLOWED_BLOCK_TYPES:
            raise HTTPException(status_code=422, detail=f"Блок #{idx + 1}: невідомий type '{block_type}'")
        if not block_id or not isinstance(block_id, str):
            raise HTTPException(status_code=422, detail=f"Блок #{idx + 1}: id обов'язковий")
        if props is None or not isinstance(props, dict):
            raise HTTPException(status_code=422, detail=f"Блок #{idx + 1}: props мають бути об'єктом")


async def _get_scope_salon_and_role(
    *,
    salon_id: int,
    db: AsyncSession,
    current_user: User,
    for_write: bool,
) -> tuple[Optional[int], RoleEnum]:
    if salon_id == 0:
        if current_user.global_role != RoleEnum.NETWORK_ADMIN:
            raise HTTPException(status_code=403, detail="Глобальний контент доступний лише мережевому адміну")
        role = RoleEnum.NETWORK_ADMIN
        scope_salon_id = None
    else:
        salon_res = await db.execute(select(Salon).where(Salon.id == salon_id))
        salon = salon_res.scalars().first()
        if not salon:
            raise HTTPException(status_code=404, detail="Салон не знайдено")

        role = await deps.get_salon_role(salon_id=salon_id, db=db, current_user=current_user)
        scope_salon_id = salon_id

    if role not in READ_ROLES:
        raise HTTPException(status_code=403, detail="Недостатньо прав")

    allow_operator_write = settings.SITE_EDITOR_OPERATOR_WRITE
    can_write = role in WRITE_ROLES or (allow_operator_write and role == RoleEnum.OPERATOR)
    if for_write and not can_write:
        raise HTTPException(status_code=403, detail="Недостатньо прав для редагування")

    return scope_salon_id, role


async def _find_page_or_404(
    *,
    db: AsyncSession,
    page_id: int,
    scope_salon_id: Optional[int],
) -> Page:
    query = select(Page).where(Page.id == page_id)
    if scope_salon_id is None:
        query = query.where(Page.salon_id.is_(None))
    else:
        query = query.where(Page.salon_id == scope_salon_id)

    result = await db.execute(query)
    page = result.scalars().first()
    if not page:
        raise HTTPException(status_code=404, detail="Сторінку не знайдено")
    return page


async def _audit_salon_id(db: AsyncSession, scope_salon_id: Optional[int]) -> Optional[int]:
    if scope_salon_id is not None:
        return scope_salon_id
    first_salon = await db.execute(select(Salon.id).order_by(Salon.id.asc()).limit(1))
    return first_salon.scalars().first()


async def _append_audit(
    *,
    db: AsyncSession,
    current_user: User,
    scope_salon_id: Optional[int],
    action: str,
    resource_type: str,
    resource_id: int,
    details: Optional[dict[str, Any]] = None,
) -> None:
    salon_id_for_log = await _audit_salon_id(db, scope_salon_id)
    if salon_id_for_log is None:
        return
    db.add(
        AuditLog(
            salon_id=salon_id_for_log,
            user_id=current_user.id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
        )
    )


async def _get_version_content(db: AsyncSession, version_id: Optional[int]) -> Optional[list[dict[str, Any]]]:
    if not version_id:
        return None
    version_res = await db.execute(select(PageVersion).where(PageVersion.id == version_id))
    version = version_res.scalars().first()
    if not version:
        return None
    return version.content_json


class SitePageCreateRequest(BaseModel):
    slug: str
    title: str
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    og_image_file_id: Optional[int] = None
    content_json: list[dict[str, Any]] = Field(default_factory=list)
    comment: Optional[str] = "Початкова версія"


class SitePageUpdateRequest(BaseModel):
    slug: Optional[str] = None
    title: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    og_image_file_id: Optional[int] = None


class SitePageSaveRequest(BaseModel):
    content_json: list[dict[str, Any]]
    comment: Optional[str] = "Збереження вручну"


class SitePageRollbackRequest(BaseModel):
    version_id: int


class PreviewTokenRequest(BaseModel):
    ttl_hours: int = 24


class SitePageListItem(BaseModel):
    id: int
    salon_id: Optional[int] = None
    slug: str
    title: str
    seo_title: Optional[str] = None
    draft_version_id: Optional[int] = None
    published_version_id: Optional[int] = None
    status: Literal["draft", "published"]
    updated_at: Optional[datetime] = None


class SitePageDetailResponse(SitePageListItem):
    seo_description: Optional[str] = None
    og_image_file_id: Optional[int] = None
    draft_content_json: Optional[list[dict[str, Any]]] = None
    published_content_json: Optional[list[dict[str, Any]]] = None


class SitePageVersionItem(BaseModel):
    id: int
    page_id: int
    created_by: int
    comment: Optional[str] = None
    created_at: Optional[datetime] = None
    is_draft: bool
    is_published: bool


class PreviewTokenResponse(BaseModel):
    preview_url: str
    expires_at: datetime


class PublicPageResponse(BaseModel):
    slug: str
    title: str
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    og_image_file_id: Optional[int] = None
    content_json: list[dict[str, Any]]
    salon_id: Optional[int] = None
    preview: bool = False
    preview_expires_at: Optional[datetime] = None


class MediaFileResponse(BaseModel):
    id: int
    salon_id: Optional[int] = None
    title: Optional[str] = None
    filename: str
    mime_type: str
    size_bytes: int
    is_public: bool
    created_at: Optional[datetime] = None
    public_url: Optional[str] = None
    private_url: str


class MediaUpdateRequest(BaseModel):
    title: Optional[str] = None
    is_public: Optional[bool] = None


@router.get("/salons/{salon_id}/site/pages", response_model=list[SitePageListItem])
async def list_site_pages(
    salon_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    scope_salon_id, _ = await _get_scope_salon_and_role(
        salon_id=salon_id, db=db, current_user=current_user, for_write=False
    )

    query = select(Page).order_by(Page.updated_at.desc(), Page.id.desc())
    if scope_salon_id is None:
        query = query.where(Page.salon_id.is_(None))
    else:
        query = query.where(Page.salon_id == scope_salon_id)

    res = await db.execute(query)
    pages = res.scalars().all()

    return [
        SitePageListItem(
            id=p.id,
            salon_id=p.salon_id,
            slug=p.slug,
            title=p.title,
            seo_title=p.seo_title,
            draft_version_id=p.draft_version_id,
            published_version_id=p.published_version_id,
            status="published" if p.published_version_id else "draft",
            updated_at=p.updated_at,
        )
        for p in pages
    ]


@router.post("/salons/{salon_id}/site/pages", response_model=SitePageDetailResponse, status_code=201)
async def create_site_page(
    salon_id: int,
    payload: SitePageCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    scope_salon_id, _ = await _get_scope_salon_and_role(
        salon_id=salon_id, db=db, current_user=current_user, for_write=True
    )
    _validate_content_json(payload.content_json)
    slug = _normalize_slug(payload.slug)

    page_exists_q = select(Page).where(Page.slug == slug)
    if scope_salon_id is None:
        page_exists_q = page_exists_q.where(Page.salon_id.is_(None))
    else:
        page_exists_q = page_exists_q.where(Page.salon_id == scope_salon_id)
    page_exists_res = await db.execute(page_exists_q)
    if page_exists_res.scalars().first():
        raise HTTPException(status_code=409, detail="Сторінка з таким слагом вже існує")

    page = Page(
        salon_id=scope_salon_id,
        slug=slug,
        title=payload.title.strip(),
        seo_title=payload.seo_title,
        seo_description=payload.seo_description,
        og_image_file_id=payload.og_image_file_id,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(page)
    await db.flush()

    version = PageVersion(
        page_id=page.id,
        content_json=payload.content_json,
        created_by=current_user.id,
        comment=payload.comment or "Початкова версія",
    )
    db.add(version)
    await db.flush()

    page.draft_version_id = version.id
    page.updated_by = current_user.id

    await _append_audit(
        db=db,
        current_user=current_user,
        scope_salon_id=scope_salon_id,
        action="site_page_created",
        resource_type="site_page",
        resource_id=page.id,
        details={"slug": page.slug, "scope": "global" if scope_salon_id is None else scope_salon_id},
    )
    await db.commit()
    await db.refresh(page)

    return SitePageDetailResponse(
        id=page.id,
        salon_id=page.salon_id,
        slug=page.slug,
        title=page.title,
        seo_title=page.seo_title,
        seo_description=page.seo_description,
        og_image_file_id=page.og_image_file_id,
        draft_version_id=page.draft_version_id,
        published_version_id=page.published_version_id,
        status="published" if page.published_version_id else "draft",
        updated_at=page.updated_at,
        draft_content_json=payload.content_json,
        published_content_json=None,
    )


@router.get("/salons/{salon_id}/site/pages/{page_id}", response_model=SitePageDetailResponse)
async def get_site_page(
    salon_id: int,
    page_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    scope_salon_id, _ = await _get_scope_salon_and_role(
        salon_id=salon_id, db=db, current_user=current_user, for_write=False
    )
    page = await _find_page_or_404(db=db, page_id=page_id, scope_salon_id=scope_salon_id)
    draft_content = await _get_version_content(db, page.draft_version_id)
    published_content = await _get_version_content(db, page.published_version_id)

    return SitePageDetailResponse(
        id=page.id,
        salon_id=page.salon_id,
        slug=page.slug,
        title=page.title,
        seo_title=page.seo_title,
        seo_description=page.seo_description,
        og_image_file_id=page.og_image_file_id,
        draft_version_id=page.draft_version_id,
        published_version_id=page.published_version_id,
        status="published" if page.published_version_id else "draft",
        updated_at=page.updated_at,
        draft_content_json=draft_content,
        published_content_json=published_content,
    )


@router.patch("/salons/{salon_id}/site/pages/{page_id}", response_model=SitePageDetailResponse)
async def patch_site_page(
    salon_id: int,
    page_id: int,
    payload: SitePageUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    scope_salon_id, _ = await _get_scope_salon_and_role(
        salon_id=salon_id, db=db, current_user=current_user, for_write=True
    )
    page = await _find_page_or_404(db=db, page_id=page_id, scope_salon_id=scope_salon_id)

    if payload.slug is not None:
        slug = _normalize_slug(payload.slug)
        if slug != page.slug:
            conflict_q = select(Page).where(Page.slug == slug, Page.id != page.id)
            if scope_salon_id is None:
                conflict_q = conflict_q.where(Page.salon_id.is_(None))
            else:
                conflict_q = conflict_q.where(Page.salon_id == scope_salon_id)
            conflict_res = await db.execute(conflict_q)
            if conflict_res.scalars().first():
                raise HTTPException(status_code=409, detail="Сторінка з таким слагом вже існує")
            page.slug = slug

    if payload.title is not None:
        page.title = payload.title.strip()
    if payload.seo_title is not None:
        page.seo_title = payload.seo_title
    if payload.seo_description is not None:
        page.seo_description = payload.seo_description
    if payload.og_image_file_id is not None:
        page.og_image_file_id = payload.og_image_file_id
    page.updated_by = current_user.id

    await _append_audit(
        db=db,
        current_user=current_user,
        scope_salon_id=scope_salon_id,
        action="site_page_meta_updated",
        resource_type="site_page",
        resource_id=page.id,
    )
    await db.commit()
    await db.refresh(page)

    draft_content = await _get_version_content(db, page.draft_version_id)
    published_content = await _get_version_content(db, page.published_version_id)
    return SitePageDetailResponse(
        id=page.id,
        salon_id=page.salon_id,
        slug=page.slug,
        title=page.title,
        seo_title=page.seo_title,
        seo_description=page.seo_description,
        og_image_file_id=page.og_image_file_id,
        draft_version_id=page.draft_version_id,
        published_version_id=page.published_version_id,
        status="published" if page.published_version_id else "draft",
        updated_at=page.updated_at,
        draft_content_json=draft_content,
        published_content_json=published_content,
    )


@router.delete("/salons/{salon_id}/site/pages/{page_id}", status_code=204)
async def delete_site_page(
    salon_id: int,
    page_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Response:
    scope_salon_id, _ = await _get_scope_salon_and_role(
        salon_id=salon_id, db=db, current_user=current_user, for_write=True
    )
    page = await _find_page_or_404(db=db, page_id=page_id, scope_salon_id=scope_salon_id)

    await db.delete(page)
    await _append_audit(
        db=db,
        current_user=current_user,
        scope_salon_id=scope_salon_id,
        action="site_page_deleted",
        resource_type="site_page",
        resource_id=page_id,
    )
    await db.commit()
    return Response(status_code=204)


@router.get("/salons/{salon_id}/site/pages/{page_id}/versions", response_model=list[SitePageVersionItem])
async def list_page_versions(
    salon_id: int,
    page_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    scope_salon_id, _ = await _get_scope_salon_and_role(
        salon_id=salon_id, db=db, current_user=current_user, for_write=False
    )
    page = await _find_page_or_404(db=db, page_id=page_id, scope_salon_id=scope_salon_id)

    versions_res = await db.execute(
        select(PageVersion).where(PageVersion.page_id == page.id).order_by(PageVersion.created_at.desc(), PageVersion.id.desc())
    )
    versions = versions_res.scalars().all()

    return [
        SitePageVersionItem(
            id=v.id,
            page_id=v.page_id,
            created_by=v.created_by,
            comment=v.comment,
            created_at=v.created_at,
            is_draft=(v.id == page.draft_version_id),
            is_published=(v.id == page.published_version_id),
        )
        for v in versions
    ]


@router.post("/salons/{salon_id}/site/pages/{page_id}/save", response_model=SitePageDetailResponse)
async def save_page_draft_version(
    salon_id: int,
    page_id: int,
    payload: SitePageSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    scope_salon_id, _ = await _get_scope_salon_and_role(
        salon_id=salon_id, db=db, current_user=current_user, for_write=True
    )
    page = await _find_page_or_404(db=db, page_id=page_id, scope_salon_id=scope_salon_id)
    _validate_content_json(payload.content_json)

    version = PageVersion(
        page_id=page.id,
        content_json=payload.content_json,
        created_by=current_user.id,
        comment=payload.comment or "Збереження",
    )
    db.add(version)
    await db.flush()

    page.draft_version_id = version.id
    page.updated_by = current_user.id

    await _append_audit(
        db=db,
        current_user=current_user,
        scope_salon_id=scope_salon_id,
        action="site_page_saved",
        resource_type="site_page",
        resource_id=page.id,
        details={"version_id": version.id, "comment": payload.comment},
    )
    await db.commit()
    await db.refresh(page)

    return SitePageDetailResponse(
        id=page.id,
        salon_id=page.salon_id,
        slug=page.slug,
        title=page.title,
        seo_title=page.seo_title,
        seo_description=page.seo_description,
        og_image_file_id=page.og_image_file_id,
        draft_version_id=page.draft_version_id,
        published_version_id=page.published_version_id,
        status="published" if page.published_version_id else "draft",
        updated_at=page.updated_at,
        draft_content_json=payload.content_json,
        published_content_json=await _get_version_content(db, page.published_version_id),
    )


@router.post("/salons/{salon_id}/site/pages/{page_id}/publish", response_model=SitePageDetailResponse)
async def publish_page(
    salon_id: int,
    page_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    scope_salon_id, _ = await _get_scope_salon_and_role(
        salon_id=salon_id, db=db, current_user=current_user, for_write=True
    )
    page = await _find_page_or_404(db=db, page_id=page_id, scope_salon_id=scope_salon_id)

    if not page.draft_version_id:
        raise HTTPException(status_code=400, detail="Немає чернетки для публікації")

    page.published_version_id = page.draft_version_id
    page.updated_by = current_user.id
    await _append_audit(
        db=db,
        current_user=current_user,
        scope_salon_id=scope_salon_id,
        action="site_page_published",
        resource_type="site_page",
        resource_id=page.id,
        details={"published_version_id": page.published_version_id},
    )
    await db.commit()
    await db.refresh(page)

    return SitePageDetailResponse(
        id=page.id,
        salon_id=page.salon_id,
        slug=page.slug,
        title=page.title,
        seo_title=page.seo_title,
        seo_description=page.seo_description,
        og_image_file_id=page.og_image_file_id,
        draft_version_id=page.draft_version_id,
        published_version_id=page.published_version_id,
        status="published",
        updated_at=page.updated_at,
        draft_content_json=await _get_version_content(db, page.draft_version_id),
        published_content_json=await _get_version_content(db, page.published_version_id),
    )


@router.post("/salons/{salon_id}/site/pages/{page_id}/rollback", response_model=SitePageDetailResponse)
async def rollback_page_draft(
    salon_id: int,
    page_id: int,
    payload: SitePageRollbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    scope_salon_id, _ = await _get_scope_salon_and_role(
        salon_id=salon_id, db=db, current_user=current_user, for_write=True
    )
    page = await _find_page_or_404(db=db, page_id=page_id, scope_salon_id=scope_salon_id)

    version_res = await db.execute(
        select(PageVersion).where(PageVersion.id == payload.version_id, PageVersion.page_id == page.id)
    )
    version = version_res.scalars().first()
    if not version:
        raise HTTPException(status_code=404, detail="Версію не знайдено")

    page.draft_version_id = version.id
    page.updated_by = current_user.id
    await _append_audit(
        db=db,
        current_user=current_user,
        scope_salon_id=scope_salon_id,
        action="site_page_rollback",
        resource_type="site_page",
        resource_id=page.id,
        details={"draft_version_id": version.id},
    )
    await db.commit()
    await db.refresh(page)

    return SitePageDetailResponse(
        id=page.id,
        salon_id=page.salon_id,
        slug=page.slug,
        title=page.title,
        seo_title=page.seo_title,
        seo_description=page.seo_description,
        og_image_file_id=page.og_image_file_id,
        draft_version_id=page.draft_version_id,
        published_version_id=page.published_version_id,
        status="published" if page.published_version_id else "draft",
        updated_at=page.updated_at,
        draft_content_json=version.content_json,
        published_content_json=await _get_version_content(db, page.published_version_id),
    )


@router.post("/salons/{salon_id}/site/pages/{page_id}/preview-token", response_model=PreviewTokenResponse)
async def create_preview_token(
    salon_id: int,
    page_id: int,
    payload: PreviewTokenRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    scope_salon_id, _ = await _get_scope_salon_and_role(
        salon_id=salon_id, db=db, current_user=current_user, for_write=True
    )
    page = await _find_page_or_404(db=db, page_id=page_id, scope_salon_id=scope_salon_id)

    one_minute_ago = _now_utc() - timedelta(minutes=1)
    too_many_res = await db.execute(
        select(PreviewToken)
        .where(PreviewToken.page_id == page.id)
        .where(PreviewToken.created_by == current_user.id)
        .where(PreviewToken.created_at >= one_minute_ago)
    )
    if len(list(too_many_res.scalars().all())) >= 5:
        raise HTTPException(status_code=429, detail="Забагато запитів на preview-токен. Спробуйте за хвилину.")

    ttl_hours = max(1, min(payload.ttl_hours, 72))
    raw_token = secrets.token_urlsafe(32)
    expires_at = _now_utc() + timedelta(hours=ttl_hours)
    token_row = PreviewToken(
        page_id=page.id,
        token_hash=_preview_token_hash(raw_token),
        expires_at=expires_at,
        created_by=current_user.id,
    )
    db.add(token_row)

    await _append_audit(
        db=db,
        current_user=current_user,
        scope_salon_id=scope_salon_id,
        action="site_page_preview_token_created",
        resource_type="site_page",
        resource_id=page.id,
        details={"expires_at": expires_at.isoformat()},
    )
    await db.commit()

    return PreviewTokenResponse(
        preview_url=f"/preview/{page.slug}?token={raw_token}",
        expires_at=expires_at,
    )


@router.get("/site/preview/{slug}", response_model=PublicPageResponse)
async def get_preview_page_by_token(
    slug: str,
    token: str = Query(..., min_length=16),
    db: AsyncSession = Depends(get_db),
) -> Any:
    token_hash = _preview_token_hash(token)
    now = _now_utc()

    query = (
        select(PreviewToken, Page)
        .join(Page, Page.id == PreviewToken.page_id)
        .where(Page.slug == slug)
        .where(PreviewToken.token_hash == token_hash)
        .where(PreviewToken.expires_at > now)
        .order_by(PreviewToken.created_at.desc())
    )
    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Preview-токен невалідний або прострочений")

    preview_token, page = row
    if not page.draft_version_id:
        raise HTTPException(status_code=404, detail="Чернетку не знайдено")

    version_res = await db.execute(select(PageVersion).where(PageVersion.id == page.draft_version_id))
    version = version_res.scalars().first()
    if not version:
        raise HTTPException(status_code=404, detail="Чернетку не знайдено")

    return PublicPageResponse(
        slug=page.slug,
        title=page.title,
        seo_title=page.seo_title,
        seo_description=page.seo_description,
        og_image_file_id=page.og_image_file_id,
        content_json=version.content_json,
        salon_id=page.salon_id,
        preview=True,
        preview_expires_at=preview_token.expires_at,
    )


@router.get("/public/site/{salon_scope}/pages/{slug}", response_model=PublicPageResponse)
async def get_published_page(
    salon_scope: str,
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> Any:
    scope_salon_id: Optional[int]
    if salon_scope.lower() == "global":
        scope_salon_id = None
    else:
        try:
            scope_salon_id = int(salon_scope)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="salon_scope має бути числом або global") from exc

    page: Optional[Page] = None
    if scope_salon_id is not None:
        salon_page_res = await db.execute(
            select(Page)
            .where(Page.salon_id == scope_salon_id, Page.slug == slug, Page.published_version_id.is_not(None))
            .order_by(Page.id.desc())
        )
        page = salon_page_res.scalars().first()

    if not page:
        global_res = await db.execute(
            select(Page)
            .where(Page.salon_id.is_(None), Page.slug == slug, Page.published_version_id.is_not(None))
            .order_by(Page.id.desc())
        )
        page = global_res.scalars().first()

    if not page or not page.published_version_id:
        raise HTTPException(status_code=404, detail="Опубліковану сторінку не знайдено")

    version_res = await db.execute(select(PageVersion).where(PageVersion.id == page.published_version_id))
    version = version_res.scalars().first()
    if not version:
        raise HTTPException(status_code=404, detail="Опубліковану версію не знайдено")

    return PublicPageResponse(
        slug=page.slug,
        title=page.title,
        seo_title=page.seo_title,
        seo_description=page.seo_description,
        og_image_file_id=page.og_image_file_id,
        content_json=version.content_json,
        salon_id=page.salon_id,
        preview=False,
        preview_expires_at=None,
    )


@router.post("/salons/{salon_id}/media/upload", response_model=MediaFileResponse, status_code=201)
async def upload_media_file(
    salon_id: int,
    is_public: bool = Form(True),
    title: Optional[str] = Form(None),
    file: UploadFile = FastAPIFile(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    scope_salon_id, _ = await _get_scope_salon_and_role(
        salon_id=salon_id, db=db, current_user=current_user, for_write=True
    )

    public_dir = os.path.join(settings.UPLOADS_DIR, "public")
    private_dir = os.path.join(settings.UPLOADS_DIR, "private")
    os.makedirs(public_dir, exist_ok=True)
    os.makedirs(private_dir, exist_ok=True)

    ext = ""
    if file.filename and "." in file.filename:
        ext = "." + file.filename.split(".")[-1].lower()
    safe_name = f"{uuid.uuid4().hex}{ext}"
    target_dir = public_dir if is_public else private_dir
    full_path = os.path.join(target_dir, safe_name)

    with open(full_path, "wb") as out:
        shutil.copyfileobj(file.file, out)

    size = os.path.getsize(full_path)
    media = DBFile(
        salon_id=scope_salon_id,
        uploaded_by_user_id=current_user.id,
        title=(title or "").strip() or None,
        filename=file.filename or safe_name,
        file_path=full_path,
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=size,
        is_public=is_public,
    )
    db.add(media)
    await db.flush()

    await _append_audit(
        db=db,
        current_user=current_user,
        scope_salon_id=scope_salon_id,
        action="site_media_uploaded",
        resource_type="media_file",
        resource_id=media.id,
        details={"is_public": is_public, "title": media.title},
    )
    await db.commit()
    await db.refresh(media)

    return MediaFileResponse(
        id=media.id,
        salon_id=media.salon_id,
        title=media.title,
        filename=media.filename,
        mime_type=media.mime_type,
        size_bytes=media.size_bytes,
        is_public=media.is_public,
        created_at=media.created_at,
        public_url=f"/api/v1/media/{media.id}" if media.is_public else None,
        private_url=f"/api/v1/private-media/{media.id}",
    )


@router.get("/salons/{salon_id}/media/list", response_model=list[MediaFileResponse])
async def list_media_files(
    salon_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    scope_salon_id, _ = await _get_scope_salon_and_role(
        salon_id=salon_id, db=db, current_user=current_user, for_write=False
    )

    query = select(DBFile).order_by(DBFile.created_at.desc(), DBFile.id.desc())
    if scope_salon_id is None:
        query = query.where(DBFile.salon_id.is_(None))
    else:
        query = query.where(or_(DBFile.salon_id == scope_salon_id, DBFile.salon_id.is_(None)))

    result = await db.execute(query)
    rows = result.scalars().all()
    return [
        MediaFileResponse(
            id=m.id,
            salon_id=m.salon_id,
            title=m.title,
            filename=m.filename,
            mime_type=m.mime_type,
            size_bytes=m.size_bytes,
            is_public=m.is_public,
            created_at=m.created_at,
            public_url=f"/api/v1/media/{m.id}" if m.is_public else None,
            private_url=f"/api/v1/private-media/{m.id}",
        )
        for m in rows
    ]


@router.patch("/salons/{salon_id}/media/{media_id}", response_model=MediaFileResponse)
async def patch_media_file(
    salon_id: int,
    media_id: int,
    payload: MediaUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    scope_salon_id, _ = await _get_scope_salon_and_role(
        salon_id=salon_id, db=db, current_user=current_user, for_write=True
    )

    media_res = await db.execute(select(DBFile).where(DBFile.id == media_id))
    media = media_res.scalars().first()
    if not media:
        raise HTTPException(status_code=404, detail="Файл не знайдено")

    if scope_salon_id is None and media.salon_id is not None:
        raise HTTPException(status_code=403, detail="Недостатньо прав")
    if scope_salon_id is not None and media.salon_id not in (None, scope_salon_id):
        raise HTTPException(status_code=403, detail="Недостатньо прав")

    if payload.title is not None:
        media.title = payload.title.strip() or None
    if payload.is_public is not None:
        media.is_public = payload.is_public

    await _append_audit(
        db=db,
        current_user=current_user,
        scope_salon_id=scope_salon_id,
        action="site_media_updated",
        resource_type="media_file",
        resource_id=media.id,
        details={"is_public": media.is_public, "title": media.title},
    )
    await db.commit()
    await db.refresh(media)

    return MediaFileResponse(
        id=media.id,
        salon_id=media.salon_id,
        title=media.title,
        filename=media.filename,
        mime_type=media.mime_type,
        size_bytes=media.size_bytes,
        is_public=media.is_public,
        created_at=media.created_at,
        public_url=f"/api/v1/media/{media.id}" if media.is_public else None,
        private_url=f"/api/v1/private-media/{media.id}",
    )


@router.get("/media/{media_id}")
async def read_public_media(
    media_id: int,
    db: AsyncSession = Depends(get_db),
) -> Any:
    media_res = await db.execute(select(DBFile).where(DBFile.id == media_id, DBFile.is_public.is_(True)))
    media = media_res.scalars().first()
    if not media or not os.path.exists(media.file_path):
        raise HTTPException(status_code=404, detail="Файл не знайдено")
    return FileResponse(path=media.file_path, filename=media.filename, media_type=media.mime_type)


@router.get("/private-media/{media_id}")
async def read_private_media(
    media_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    media_res = await db.execute(select(DBFile).where(DBFile.id == media_id))
    media = media_res.scalars().first()
    if not media or not os.path.exists(media.file_path):
        raise HTTPException(status_code=404, detail="Файл не знайдено")

    if media.salon_id is None:
        if current_user.global_role != RoleEnum.NETWORK_ADMIN:
            raise HTTPException(status_code=403, detail="Недостатньо прав")
    elif current_user.global_role != RoleEnum.NETWORK_ADMIN:
        access_res = await db.execute(
            select(UserSalonAccess).where(
                and_(UserSalonAccess.user_id == current_user.id, UserSalonAccess.salon_id == media.salon_id)
            )
        )
        if not access_res.scalars().first():
            raise HTTPException(status_code=403, detail="Недостатньо прав")

    return FileResponse(path=media.file_path, filename=media.filename, media_type=media.mime_type)
