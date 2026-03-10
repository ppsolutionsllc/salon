from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core.security import get_password_hash
from app.db.database import get_db
from app.db.models import User, RoleEnum
from app.schemas.user import UserCreate, UserResponse, UserUpdate

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """List all users. Only for network or salon admins."""
    if current_user.global_role not in [RoleEnum.NETWORK_ADMIN, RoleEnum.SALON_ADMIN]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    result = await db.execute(select(User).order_by(User.id))
    return result.scalars().all()


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Create a new user. Only NETWORK_ADMIN can assign NETWORK_ADMIN/SALON_ADMIN roles."""
    if current_user.global_role not in [RoleEnum.NETWORK_ADMIN, RoleEnum.SALON_ADMIN]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Prevent salon admins from creating network admins
    if user_in.global_role == RoleEnum.NETWORK_ADMIN and current_user.global_role != RoleEnum.NETWORK_ADMIN:
        raise HTTPException(status_code=403, detail="Only network admins can create other network admins")

    # Check uniqueness
    existing = await db.execute(select(User).where(User.email == user_in.email))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="User with this login already exists")

    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        global_role=user_in.global_role,
        is_active=user_in.is_active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    if current_user.global_role not in [RoleEnum.NETWORK_ADMIN, RoleEnum.SALON_ADMIN]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    if current_user.global_role not in [RoleEnum.NETWORK_ADMIN, RoleEnum.SALON_ADMIN]:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_in.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> None:
    if current_user.global_role != RoleEnum.NETWORK_ADMIN:
        raise HTTPException(status_code=403, detail="Only network admins can delete users")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.delete(user)
    await db.commit()
