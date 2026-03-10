from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.db.database import get_db
from app.db.models import Salon, User, RoleEnum, UserSalonAccess
from pydantic import BaseModel

router = APIRouter()

class SalonBase(BaseModel):
    name: str
    address: str | None = None
    timezone: str = "UTC"

class SalonResponse(SalonBase):
    id: int
    class Config:
        from_attributes = True

@router.get("/", response_model=List[SalonResponse])
async def read_salons(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Retrieve salons accessible to user."""
    if current_user.global_role == RoleEnum.NETWORK_ADMIN:
        result = await db.execute(select(Salon))
        return result.scalars().all()
        
    result = await db.execute(
        select(Salon)
        .join(UserSalonAccess)
        .where(UserSalonAccess.user_id == current_user.id)
    )
    return result.scalars().all()

@router.post("/", response_model=SalonResponse, status_code=201)
async def create_salon(
    salon_in: SalonBase,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """Create a new salon. Only for NETWORK_ADMIN or SALON_ADMIN."""
    if current_user.global_role not in [RoleEnum.NETWORK_ADMIN, RoleEnum.SALON_ADMIN]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    salon = Salon(**salon_in.model_dump())
    db.add(salon)
    await db.commit()
    await db.refresh(salon)
    return salon
