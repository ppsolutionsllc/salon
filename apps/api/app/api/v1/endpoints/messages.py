from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.db.database import get_db
from app.db.models import MessageTemplate, Message, MessageChannelEnum, MessageStatusEnum, Salon
from pydantic import BaseModel

router = APIRouter()

class TemplateBase(BaseModel):
    name: str
    channel: MessageChannelEnum
    content: str

class TemplateResponse(TemplateBase):
    id: int
    salon_id: int
    class Config:
        from_attributes = True

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    channel: Optional[MessageChannelEnum] = None
    content: Optional[str] = None

class MessageLogResponse(BaseModel):
    id: int
    salon_id: int
    client_id: int
    channel: MessageChannelEnum
    content: str
    status: MessageStatusEnum
    provider_response: Optional[str] = None

    class Config:
        from_attributes = True

@router.get("/{salon_id}/messages/templates", response_model=List[TemplateResponse])
async def read_templates(
    salon_id: int,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon)
) -> Any:
    result = await db.execute(select(MessageTemplate).where(MessageTemplate.salon_id == salon_id))
    return result.scalars().all()

@router.post("/{salon_id}/messages/templates", response_model=TemplateResponse)
async def create_template(
    salon_id: int,
    template_in: TemplateBase,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon)
) -> Any:
    template = MessageTemplate(**template_in.model_dump(), salon_id=salon_id)
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template

@router.patch("/{salon_id}/messages/templates/{template_id}", response_model=TemplateResponse)
async def update_template(
    salon_id: int,
    template_id: int,
    template_in: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon)
) -> Any:
    result = await db.execute(
        select(MessageTemplate).where(
            MessageTemplate.id == template_id,
            MessageTemplate.salon_id == salon_id
        )
    )
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    payload = template_in.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(template, key, value)

    await db.commit()
    await db.refresh(template)
    return template

@router.delete("/{salon_id}/messages/templates/{template_id}", status_code=204)
async def delete_template(
    salon_id: int,
    template_id: int,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon)
) -> None:
    result = await db.execute(
        select(MessageTemplate).where(
            MessageTemplate.id == template_id,
            MessageTemplate.salon_id == salon_id
        )
    )
    template = result.scalars().first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    await db.delete(template)
    await db.commit()

@router.get("/{salon_id}/messages/logs", response_model=List[MessageLogResponse])
async def read_message_logs(
    salon_id: int,
    status: Optional[MessageStatusEnum] = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon)
) -> Any:
    query = select(Message).where(Message.salon_id == salon_id).order_by(Message.id.desc()).limit(limit)
    if status:
        query = query.where(Message.status == status)
    result = await db.execute(query)
    return result.scalars().all()
