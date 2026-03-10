from pydantic import BaseModel
from typing import Optional
from app.db.models import RoleEnum

class UserBase(BaseModel):
    email: str
    global_role: RoleEnum = RoleEnum.CLIENT
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[str] = None
    global_role: Optional[RoleEnum] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str

class TokenPayload(BaseModel):
    sub: Optional[int] = None
