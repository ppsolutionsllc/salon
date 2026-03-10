from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.db.database import get_db
from app.db.models import PaymentIntent, Payment, PaymentStatusEnum, Salon
from pydantic import BaseModel

router = APIRouter()

class IntentBase(BaseModel):
    client_id: int
    appointment_id: Optional[int] = None
    amount: float

class IntentResponse(IntentBase):
    id: int
    salon_id: int
    status: PaymentStatusEnum
    class Config:
        from_attributes = True

@router.get("/{salon_id}/payments/intents", response_model=List[IntentResponse])
async def read_intents(
    salon_id: int,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon)
) -> Any:
    result = await db.execute(select(PaymentIntent).where(PaymentIntent.salon_id == salon_id))
    return result.scalars().all()

@router.post("/{salon_id}/payments/intents", response_model=IntentResponse)
async def create_intent(
    salon_id: int,
    intent_in: IntentBase,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon)
) -> Any:
    intent = PaymentIntent(**intent_in.model_dump(), salon_id=salon_id)
    db.add(intent)
    await db.commit()
    await db.refresh(intent)
    return intent
