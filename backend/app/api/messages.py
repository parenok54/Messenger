import uuid
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.storage import upload_file
from app.models.user import User
from app.models.message import Message, MessageType
from app.schemas.message import (
    MessageCreate,
    MessageUpdate,
    MessageOut,
    MessagePage,
    ReactionToggle,
)
from app.services import message_service
from app.services.deps import get_current_user
from app.ws.gateway import broadcast_to_chat

router = APIRouter(prefix="/chats/{chat_id}/messages", tags=["Сообщения"])


async def _ensure_message_in_chat(
    chat_id: uuid.UUID, message_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession
) -> Message:
    """
    Проверяет, что сообщение принадлежит указанному чату и что пользователь
    имеет к этому чату доступ. Защищает от подмены chat_id/message_id в URL.
    """
    from app.models.chat import ChatMember

    result = await db.execute(
        select(Message).where(Message.id == message_id)
    )
    message = result.scalar_one_or_none()
    if not message or message.chat_id != chat_id:
        raise HTTPException(404, "Сообщение не найдено в этом чате")

    access = await db.execute(
        select(ChatMember).where(
            ChatMember.chat_id == chat_id, ChatMember.user_id == user_id
        )
    )
    if not access.scalar_one_or_none():
        raise HTTPException(403, "Нет доступа к чату")

    return message


@router.get("", response_model=MessagePage)
async def get_messages(
    chat_id: uuid.UUID,
    before_id: Optional[uuid.UUID] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """История сообщений с пагинацией (cursor-based)."""
    return await message_service.get_messages(chat_id, current_user.id, db, before_id, min(limit, 100))


@router.post("", response_model=MessageOut)
async def send_message(
    chat_id: uuid.UUID,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Отправить текстовое сообщение."""
    return await message_service.send_message(chat_id, data, current_user, db)


@router.post("/upload", response_model=MessageOut)
async def send_file(
    chat_id: uuid.UUID,
    file: UploadFile = File(...),
    reply_to_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Отправить файл/медиа."""
    ct = file.content_type or ""
    if not settings.is_allowed_message_content_type(ct):
        raise HTTPException(400, "Недопустимый тип файла")

    file_bytes = await file.read()
    if len(file_bytes) > settings.MAX_MESSAGE_FILE_SIZE:
        raise HTTPException(400, "Файл слишком большой (макс. 25 МБ)")
    if not file_bytes:
        raise HTTPException(400, "Пустой файл")

    from app.models.chat import ChatMember

    # Проверить доступ
    result = await db.execute(
        select(ChatMember, Chat)
        .join(Chat, Chat.id == ChatMember.chat_id)
        .where(
            ChatMember.chat_id == chat_id, ChatMember.user_id == current_user.id
        )
    )
    membership = result.first()
    if not membership:
        raise HTTPException(403, "Нет доступа к чату")
    member, chat = membership
    if chat.type == ChatType.channel and member.role == MemberRole.member:
        raise HTTPException(403, "Только администраторы могут публиковать в канале")

    if reply_to_id:
        await message_service.validate_reply_to(reply_to_id, chat_id, db)

    url = await upload_file(file_bytes, file.filename, ct)

    # Определить тип сообщения
    if ct.startswith("image/"):
        msg_type = MessageType.image
    elif ct.startswith("video/"):
        msg_type = MessageType.video
    elif ct.startswith("audio/"):
        msg_type = MessageType.audio
    else:
        msg_type = MessageType.file

    msg = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        type=msg_type,
        file_url=url,
        file_name=file.filename,
        file_size=len(file_bytes),
        reply_to_id=reply_to_id,
    )
    db.add(msg)
    await db.commit()

    result = await db.execute(
        select(Message)
        .where(Message.id == msg.id)
        .options(
            selectinload(Message.sender),
            selectinload(Message.reply_to).selectinload(Message.sender),
            selectinload(Message.reactions),
        )
    )
    saved_msg = result.scalar_one()
    msg_out = MessageOut.model_validate(saved_msg).model_dump(mode="json")

    await broadcast_to_chat(str(chat_id), {"type": "new_message", "message": msg_out}, db)
    return saved_msg


@router.patch("/{message_id}", response_model=MessageOut)
async def edit_message(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    data: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Редактировать своё сообщение."""
    await _ensure_message_in_chat(chat_id, message_id, current_user.id, db)
    edited_msg = await message_service.edit_message(message_id, data, current_user, db)
    msg_out = MessageOut.model_validate(edited_msg).model_dump(mode="json")

    await broadcast_to_chat(str(chat_id), {"type": "message_edited", "message": msg_out}, db)
    return edited_msg


@router.delete("/{message_id}")
async def delete_message(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удалить своё сообщение."""
    await _ensure_message_in_chat(chat_id, message_id, current_user.id, db)
    await message_service.delete_message(message_id, current_user, db)

    await broadcast_to_chat(
        str(chat_id),
        {"type": "message_deleted", "message_id": str(message_id), "chat_id": str(chat_id)},
        db,
    )
    return {"detail": "Сообщение удалено"}


@router.post("/{message_id}/reactions")
async def toggle_reaction_endpoint(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    data: ReactionToggle,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Поставить или снять реакцию на сообщение."""
    reactions = await message_service.toggle_reaction(
        chat_id, message_id, current_user.id, data.emoji, db
    )
    return {"status": "ok", "reactions": reactions}
