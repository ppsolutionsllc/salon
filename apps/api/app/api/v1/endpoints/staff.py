from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel, EmailStr

from app.api import deps
from app.db.database import get_db
from app.db.models import Staff, Salon, User, UserSalonAccess, RoleEnum
from app.core.security import get_password_hash

router = APIRouter()


class StaffCreate(BaseModel):
    first_name: str
    last_name: str
    phone: Optional[str] = None
    # User account fields (optional – creates login access to /staff cabinet)
    email: Optional[str] = None
    password: Optional[str] = None


class StaffResponse(BaseModel):
    id: int
    salon_id: int
    first_name: str
    last_name: str
    phone: Optional[str] = None
    user_id: Optional[int] = None
    user_email: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/{salon_id}/staff", response_model=List[StaffResponse])
async def read_staff(
    salon_id: int,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon)
) -> Any:
    result = await db.execute(select(Staff).where(Staff.salon_id == salon_id))
    staff_list = result.scalars().all()

    # Augment with user email
    out = []
    for s in staff_list:
        email = None
        if s.user_id:
            u_res = await db.execute(select(User).where(User.id == s.user_id))
            u = u_res.scalars().first()
            email = u.email if u else None
        out.append(StaffResponse(
            id=s.id, salon_id=s.salon_id,
            first_name=s.first_name, last_name=s.last_name,
            phone=s.phone, user_id=s.user_id, user_email=email
        ))
    return out


@router.post("/{salon_id}/staff", response_model=StaffResponse, status_code=201)
async def create_staff(
    salon_id: int,
    staff_in: StaffCreate,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Create staff member.
    If email + password are provided, create a User account with STAFF role
    and grant access to this salon — so they can log in to /staff cabinet.
    """
    user_id = None

    if staff_in.email and staff_in.password:
        # Check if user already exists
        res = await db.execute(select(User).where(User.email == staff_in.email))
        existing_user = res.scalars().first()
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail=f"User with email '{staff_in.email}' already exists"
            )

        # Create User account
        user = User(
            email=staff_in.email,
            hashed_password=get_password_hash(staff_in.password),
            global_role=RoleEnum.STAFF,
            is_active=True
        )
        db.add(user)
        await db.flush()

        # Grant salon access
        access = UserSalonAccess(
            user_id=user.id,
            salon_id=salon_id,
            role_override=RoleEnum.STAFF
        )
        db.add(access)
        await db.flush()
        user_id = user.id

    # Create Staff profile
    staff = Staff(
        salon_id=salon_id,
        user_id=user_id,
        first_name=staff_in.first_name,
        last_name=staff_in.last_name,
        phone=staff_in.phone
    )
    db.add(staff)
    await db.commit()
    await db.refresh(staff)

    return StaffResponse(
        id=staff.id, salon_id=staff.salon_id,
        first_name=staff.first_name, last_name=staff.last_name,
        phone=staff.phone, user_id=staff.user_id,
        user_email=staff_in.email
    )


@router.patch("/{salon_id}/staff/{staff_id}", response_model=StaffResponse)
async def update_staff(
    salon_id: int,
    staff_id: int,
    staff_in: StaffCreate,
    db: AsyncSession = Depends(get_db),
    salon: Salon = Depends(deps.get_current_salon),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    res = await db.execute(
        select(Staff).where(Staff.id == staff_id, Staff.salon_id == salon_id)
    )
    staff = res.scalars().first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    if staff_in.first_name:
        staff.first_name = staff_in.first_name
    if staff_in.last_name:
        staff.last_name = staff_in.last_name
    if staff_in.phone is not None:
        staff.phone = staff_in.phone

    await db.commit()
    await db.refresh(staff)

    email = None
    if staff.user_id:
        u_res = await db.execute(select(User).where(User.id == staff.user_id))
        u = u_res.scalars().first()
        email = u.email if u else None

    return StaffResponse(
        id=staff.id, salon_id=staff.salon_id,
        first_name=staff.first_name, last_name=staff.last_name,
        phone=staff.phone, user_id=staff.user_id, user_email=email
    )
