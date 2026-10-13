from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid
from app.models.message import MessageType
from app.schemas.user import UserPublic


class MessageCreate(BaseModel):
    content: Optional[str] = None
    type: MessageType = MessageType.text
    reply_to_id: Optional[uuid.UUID] = None


class MessageUpdate(BaseModel):
    content: str


class MessageReplyOut(BaseModel):
    id: uuid.UUID
    sender: Optional[UserPublic] = None
    content: Optional[str] = None
    type: MessageType = MessageType.text
    file_name: Optional[str] = None

    model_config = {"from_attributes": True}


class ReactionOut(BaseModel):
    id: uuid.UUID
    message_id: uuid.UUID
    user_id: uuid.UUID
    emoji: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ReactionToggle(BaseModel):
    emoji: str


class MessageOut(BaseModel):
    id: uuid.UUID
    chat_id: uuid.UUID
    sender: Optional[UserPublic]
    content: Optional[str]
    type: MessageType
    file_url: Optional[str]
    file_name: Optional[str]
    file_size: Optional[int]
    reply_to_id: Optional[uuid.UUID]
    reply_to: Optional[MessageReplyOut] = None
    reactions: list[ReactionOut] = []
    is_edited: bool
    is_deleted: bool
    created_at: datetime
    edited_at: Optional[datetime]

    model_config = {"from_attributes": True}


class MessagePage(BaseModel):
    items: list[MessageOut]
    total: int
    has_more: bool
