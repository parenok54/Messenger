from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid
from app.schemas.user import UserPublic
from app.models.chat import ChatType, MemberRole


class ChatCreate(BaseModel):
    type: ChatType = ChatType.private
    title: Optional[str] = None
    description: Optional[str] = None
    member_ids: list[uuid.UUID] = []


class ChatRoleCreate(BaseModel):
    name: str
    color: Optional[str] = "#2AABEE"
    can_manage_roles: bool = False
    can_manage_members: bool = False
    can_delete_messages: bool = False
    can_pin_messages: bool = False
    can_change_info: bool = False
    can_post_messages: bool = True
    position: Optional[int] = 0


class ChatRoleUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    can_manage_roles: Optional[bool] = None
    can_manage_members: Optional[bool] = None
    can_delete_messages: Optional[bool] = None
    can_pin_messages: Optional[bool] = None
    can_change_info: Optional[bool] = None
    can_post_messages: Optional[bool] = None
    position: Optional[int] = None


class ChatRoleOut(BaseModel):
    id: uuid.UUID
    chat_id: uuid.UUID
    name: str
    color: Optional[str] = "#2AABEE"
    can_manage_roles: bool
    can_manage_members: bool
    can_delete_messages: bool
    can_pin_messages: bool
    can_change_info: bool
    can_post_messages: bool
    position: int
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberRoleUpdate(BaseModel):
    role: Optional[MemberRole] = None
    custom_role_id: Optional[uuid.UUID] = None
    custom_title: Optional[str] = None
    can_manage_roles: Optional[bool] = None
    can_manage_members: Optional[bool] = None
    can_delete_messages: Optional[bool] = None
    can_pin_messages: Optional[bool] = None
    can_change_info: Optional[bool] = None
    can_post_messages: Optional[bool] = None


class ChatMemberOut(BaseModel):
    user: UserPublic
    role: MemberRole
    custom_role_id: Optional[uuid.UUID] = None
    custom_role: Optional[ChatRoleOut] = None
    custom_title: Optional[str] = None
    can_manage_roles: bool = False
    can_manage_members: bool = False
    can_delete_messages: bool = False
    can_pin_messages: bool = False
    can_change_info: bool = False
    can_post_messages: bool = True
    joined_at: datetime
    last_read_at: Optional[datetime] = None
    last_read_message_id: Optional[uuid.UUID] = None

    model_config = {"from_attributes": True}


class ChatOut(BaseModel):
    id: uuid.UUID
    type: ChatType
    title: Optional[str]
    description: Optional[str]
    avatar_url: Optional[str]
    created_at: datetime
    members: list[ChatMemberOut] = []
    roles: list[ChatRoleOut] = []
    last_message: Optional["MessageOut"] = None
    unread_count: int = 0
    pinned_message_id: Optional[uuid.UUID] = None
    pinned_message: Optional["MessageOut"] = None

    model_config = {"from_attributes": True}


# Импорт после определения ChatOut во избежание circular import
from app.schemas.message import MessageOut

ChatOut.model_rebuild()

