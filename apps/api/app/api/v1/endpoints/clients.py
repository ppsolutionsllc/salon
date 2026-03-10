from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.db.database import get_db
from app.db.models import Client, Salon
from pydantic import BaseModel

router = APIRouter()

class ClientBase(BaseModel):
    first_name: str
    last_name: Optional[str] = None
    phone: str
    email: Optional[str] = None
    notes: Optional[str] = None

class ClientResponse(ClientBase):
    id: int
    salon_id: int
    class Config:
        from_attributes = True

@router.get("/{salon_id}/clients", response_model=List[ClientResponse])
async def read_clients(
    salon_id: int,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon)
) -> Any:
    result = await db.execute(select(Client).where(Client.salon_id == salon_id))
    return result.scalars().all()

@router.get("/{salon_id}/clients/{client_id}", response_model=ClientResponse)
async def read_client(
    salon_id: int,
    client_id: int,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon)
) -> Any:
    result = await db.execute(
        select(Client)
        .where(Client.salon_id == salon_id)
        .where(Client.id == client_id)
    )
    client = result.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client

@router.post("/{salon_id}/clients", response_model=ClientResponse)
async def create_client(
    salon_id: int,
    client_in: ClientBase,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon)
) -> Any:
    # Check if client with phone already exists in this salon
    existing = await db.execute(
        select(Client)
        .where(Client.salon_id == salon_id)
        .where(Client.phone == client_in.phone)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Client with this phone already exists in this salon")
        
    client = Client(**client_in.model_dump(), salon_id=salon_id)
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client
