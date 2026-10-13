import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, Enum, func, Boolean, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
import enum


class ChatType(str, enum.Enum):
    private = "private"
    group = "group"
    channel = "channel"


class MemberRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    member = "member"


class ChatRole(Base):
    __tablename__ = "chat_roles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    chat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    color: Mapped[str | None] = mapped_column(String(32), nullable=True, default="#2AABEE")

    # Permissions
    can_manage_roles: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_manage_members: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_delete_messages: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_pin_messages: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_change_info: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_post_messages: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    position: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    chat: Mapped["Chat"] = relationship("Chat", back_populates="roles")
    members: Mapped[list["ChatMember"]] = relationship("ChatMember", back_populates="custom_role")


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    type: Mapped[ChatType] = mapped_column(
        Enum(ChatType, name="chat_type"), nullable=False, default=ChatType.private
    )
    title: Mapped[str | None] = mapped_column(String(128), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    pinned_message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("messages.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    members: Mapped[list["ChatMember"]] = relationship(
        "ChatMember", back_populates="chat", lazy="select", cascade="all, delete-orphan"
    )
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="chat", foreign_keys="[Message.chat_id]", lazy="select", cascade="all, delete-orphan"
    )
    pinned_message: Mapped["Message | None"] = relationship(
        "Message", foreign_keys=[pinned_message_id], lazy="selectin"
    )
    roles: Mapped[list["ChatRole"]] = relationship(
        "ChatRole", back_populates="chat", lazy="select", cascade="all, delete-orphan", order_by="ChatRole.position"
    )


class ChatMember(Base):
    __tablename__ = "chat_members"

    chat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[MemberRole] = mapped_column(
        Enum(MemberRole, name="member_role"), nullable=False, default=MemberRole.member
    )
    custom_role_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_roles.id", ondelete="SET NULL"), nullable=True
    )
    custom_title: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Direct permission flags
    can_manage_roles: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    can_manage_members: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    can_delete_messages: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    can_pin_messages: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    can_change_info: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    can_post_messages: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)

    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_read_message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("messages.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    chat: Mapped["Chat"] = relationship("Chat", back_populates="members")
    user: Mapped["User"] = relationship("User", back_populates="chat_memberships")
    custom_role: Mapped["ChatRole | None"] = relationship("ChatRole", back_populates="members", lazy="select")

