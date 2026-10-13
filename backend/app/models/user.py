import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True, index=True)
    username: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True, index=True)
    email: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    bio: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    chat_memberships: Mapped[list["ChatMember"]] = relationship(
        "ChatMember", back_populates="user", lazy="select"
    )
    sent_messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="sender", lazy="select"
    )
