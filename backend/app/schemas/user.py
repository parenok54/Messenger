from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional
import uuid


class UserBase(BaseModel):
    username: Optional[str] = None
    display_name: str
    bio: Optional[str] = None


class UserCreate(BaseModel):
    phone: str
    display_name: str = ""


class UserUpdate(BaseModel):
    username: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None
    email: Optional[str] = None


class UserOut(BaseModel):
    id: uuid.UUID
    phone: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str]
    display_name: str
    bio: Optional[str]
    avatar_url: Optional[str]
    is_online: bool
    last_seen: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class UserPublic(BaseModel):
    """Публичный профиль пользователя (без телефона)."""
    id: uuid.UUID
    username: Optional[str]
    display_name: str
    bio: Optional[str]
    avatar_url: Optional[str]
    is_online: bool
    last_seen: datetime

    model_config = {"from_attributes": True}
