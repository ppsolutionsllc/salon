from typing import Annotated, Optional
from fastapi import Depends, HTTPException, status, Header, Path
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.db.database import get_db
from app.db.models import User, Salon, RoleEnum, UserSalonAccess

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"/api/v1/auth/login")

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError as e:
        print("JWTError:", str(e), "Token:", token[:30] + "...")
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalars().first()
    
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    return current_user

async def get_current_salon(
    salon_id: int = Path(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Salon:
    """Dependency that checks if the user has access to the requested salon_id."""
    
    # Check if user is network admin (has global access)
    if current_user.global_role == RoleEnum.NETWORK_ADMIN:
        result = await db.execute(select(Salon).where(Salon.id == salon_id))
        salon = result.scalars().first()
        if salon is None:
            raise HTTPException(status_code=404, detail="Salon not found")
        return salon
        
    # Check explicit access mapping
    access_query = await db.execute(
        select(UserSalonAccess)
        .where(UserSalonAccess.user_id == current_user.id)
        .where(UserSalonAccess.salon_id == salon_id)
    )
    access = access_query.scalars().first()
    
    if not access:
        raise HTTPException(status_code=403, detail="Not enough permissions for this salon")
        
    result = await db.execute(select(Salon).where(Salon.id == salon_id))
    salon = result.scalars().first()
    
    if salon is None:
        raise HTTPException(status_code=404, detail="Salon not found")
        
    return salon

async def get_salon_role(
    salon_id: int = Path(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> RoleEnum:
    if current_user.global_role == RoleEnum.NETWORK_ADMIN:
        return RoleEnum.NETWORK_ADMIN
        
    access_query = await db.execute(
        select(UserSalonAccess)
        .where(UserSalonAccess.user_id == current_user.id)
        .where(UserSalonAccess.salon_id == salon_id)
    )
    access = access_query.scalars().first()
    
    if not access:
        raise HTTPException(status_code=403, detail="Not enough permissions for this salon")
        
    return access.role_override or current_user.global_role
