from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core import security
from app.core.config import settings
from app.db.database import get_db
from app.db.models import User
from app.schemas.user import Token, UserResponse, TokenPayload
from app.api import deps

router = APIRouter()

@router.post("/login", response_model=Token)
async def login_access_token(
    db: AsyncSession = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """OAuth2 compatible token login, get an access token for future requests"""
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()
    
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    elif not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.id, expires_delta=access_token_expires
    )
    refresh_token = security.create_refresh_token(
        user.id, expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "refresh_token": refresh_token
    }

@router.post("/refresh", response_model=Token)
async def refresh_access_token(
    refresh_token: str,
    db: AsyncSession = Depends(get_db)
) -> Any:
    try:
        payload = security.jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
    except security.JWTError:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
        
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalars().first()
    
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    access_token = security.create_access_token(user.id)
    new_refresh_token = security.create_refresh_token(user.id)
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "refresh_token": new_refresh_token
    }

@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """Get current user."""
    return current_user
