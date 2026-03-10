from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.db.database import get_db
from app.db.models import Service, ServiceCategory, Salon
from pydantic import BaseModel

router = APIRouter()

class ServiceCategoryBase(BaseModel):
    name: str
    color: str | None = None

class ServiceBase(BaseModel):
    name: str
    description: str | None = None
    duration_minutes: int = 60
    buffer_before: int = 0
    buffer_after: int = 0
    price: float = 0.0
    category_id: int | None = None

class ServiceResponse(ServiceBase):
    id: int
    salon_id: int
    class Config:
        from_attributes = True

@router.get("/{salon_id}/services", response_model=List[ServiceResponse])
async def read_services(
    salon_id: int,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon)
) -> Any:
    result = await db.execute(select(Service).where(Service.salon_id == salon_id))
    return result.scalars().all()

@router.post("/{salon_id}/services", response_model=ServiceResponse)
async def create_service(
    salon_id: int,
    service_in: ServiceBase,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon)
) -> Any:
    service = Service(**service_in.model_dump(), salon_id=salon_id)
    db.add(service)
    await db.commit()
    await db.refresh(service)
    return service
