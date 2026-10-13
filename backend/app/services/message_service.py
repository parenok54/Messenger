import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.message import Message, MessageReaction
from app.models.chat import Chat, ChatMember, ChatType, MemberRole
from app.models.user import User
from app.schemas.message import MessageCreate, MessageUpdate, MessagePage, MessageOut


async def _check_access(chat_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession, is_send: bool = False):
    result = await db.execute(
        select(ChatMember, Chat).join(Chat, Chat.id == ChatMember.chat_id).where(
            ChatMember.chat_id == chat_id, ChatMember.user_id == user_id
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(403, "Нет доступа к чату")
    
    member, chat = row
    if is_send and chat.type == ChatType.channel and member.role == MemberRole.member:
        raise HTTPException(403, "Только администраторы могут публиковать в канале")


async def validate_reply_to(
    reply_to_id: uuid.UUID | None, chat_id: uuid.UUID, db: AsyncSession
) -> None:
    """Ответ можно прикрепить только к существующему сообщению этого же чата."""
    if not reply_to_id:
        return

    reply_to = await db.get(Message, reply_to_id)
    if not reply_to or reply_to.chat_id != chat_id:
        raise HTTPException(404, "Сообщение для ответа не найдено в этом чате")


async def send_message(
    chat_id: uuid.UUID, data: MessageCreate, sender: User, db: AsyncSession
) -> Message:
    await _check_access(chat_id, sender.id, db, is_send=True)

    await validate_reply_to(data.reply_to_id, chat_id, db)

    msg = Message(
        chat_id=chat_id,
        sender_id=sender.id,
        content=data.content,
        type=data.type,
        reply_to_id=data.reply_to_id,
    )
    db.add(msg)
    await db.commit()

    # Загрузить вместе с sender, reply_to и reactions
    await db.refresh(msg)
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

    # Отправляем событие в WebSocket всем участникам чата
    from app.ws.gateway import broadcast_to_chat

    msg_out = MessageOut.model_validate(saved_msg).model_dump(mode="json")
    await broadcast_to_chat(str(chat_id), {"type": "new_message", "message": msg_out}, db)

    return saved_msg


async def get_messages(
    chat_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession,
    before_id: uuid.UUID | None = None, limit: int = 50
) -> MessagePage:
    await _check_access(chat_id, user_id, db)

    query = (
        select(Message)
        .where(Message.chat_id == chat_id, Message.is_deleted == False)
        .options(
            selectinload(Message.sender),
            selectinload(Message.reply_to).selectinload(Message.sender),
            selectinload(Message.reactions),
        )
        .order_by(desc(Message.created_at))
        .limit(limit + 1)
    )

    if before_id:
        before_msg = await db.get(Message, before_id)
        if before_msg:
            query = query.where(Message.created_at < before_msg.created_at)

    result = await db.execute(query)
    messages = result.scalars().all()
    has_more = len(messages) > limit
    items = list(reversed(messages[:limit]))

    total_result = await db.execute(
        select(func.count()).where(Message.chat_id == chat_id, Message.is_deleted == False)
    )
    total = total_result.scalar()

    return MessagePage(items=items, total=total, has_more=has_more)


async def edit_message(
    message_id: uuid.UUID, data: MessageUpdate, user: User, db: AsyncSession
) -> Message:
    msg = await db.get(Message, message_id)
    if not msg:
        raise HTTPException(404, "Сообщение не найдено")
    if msg.sender_id != user.id:
        raise HTTPException(403, "Можно редактировать только свои сообщения")
    if msg.is_deleted:
        raise HTTPException(400, "Нельзя редактировать удалённое сообщение")

    msg.content = data.content
    msg.is_edited = True
    msg.edited_at = datetime.now(timezone.utc)
    await db.commit()

    result = await db.execute(
        select(Message)
        .where(Message.id == message_id)
        .options(
            selectinload(Message.sender),
            selectinload(Message.reply_to).selectinload(Message.sender),
            selectinload(Message.reactions),
        )
    )
    return result.scalar_one()


async def delete_message(message_id: uuid.UUID, user: User, db: AsyncSession):
    msg = await db.get(Message, message_id)
    if not msg:
        raise HTTPException(404, "Сообщение не найдено")
    if msg.sender_id != user.id:
        raise HTTPException(403, "Можно удалять только свои сообщения")

    msg.is_deleted = True
    msg.content = None
    await db.commit()


async def toggle_reaction(
    chat_id: uuid.UUID, message_id: uuid.UUID, user_id: uuid.UUID, emoji: str, db: AsyncSession
) -> list[MessageReaction]:
    await _check_access(chat_id, user_id, db)

    msg = await db.get(Message, message_id)
    if not msg or msg.chat_id != chat_id or msg.is_deleted:
        raise HTTPException(404, "Сообщение не найдено в этом чате")

    res = await db.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == user_id,
            MessageReaction.emoji == emoji,
        )
    )
    existing = res.scalar_one_or_none()

    if existing:
        await db.delete(existing)
    else:
        new_reaction = MessageReaction(
            message_id=message_id,
            user_id=user_id,
            emoji=emoji,
        )
        db.add(new_reaction)

    await db.commit()

    res_all = await db.execute(
        select(MessageReaction)
        .where(MessageReaction.message_id == message_id)
        .order_by(MessageReaction.created_at)
    )
    reactions = list(res_all.scalars().all())

    from app.ws.gateway import broadcast_to_chat
    from app.schemas.message import ReactionOut

    reactions_out = [
        ReactionOut.model_validate(r).model_dump(mode="json") for r in reactions
    ]
    await broadcast_to_chat(
        str(chat_id),
        {
            "type": "message_reaction",
            "chat_id": str(chat_id),
            "message_id": str(message_id),
            "reactions": reactions_out,
        },
        db,
    )

    return reactions

