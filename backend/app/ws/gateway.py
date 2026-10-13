"""
WebSocket Gateway

Протокол:
  Клиент → Сервер:
    { "type": "send_message",   "chat_id": "...", "content": "...", "reply_to_id": null }
    { "type": "typing_start",   "chat_id": "..." }
    { "type": "typing_stop",    "chat_id": "..." }
    { "type": "read",           "chat_id": "...", "message_id": "..." }
    { "type": "call_offer",     "target_user_id": "...", "chat_id": "...", "offer": {...}, "is_video": bool }
    { "type": "call_answer",    "target_user_id": "...", "answer": {...} }
    { "type": "ice_candidate",  "target_user_id": "...", "candidate": {...} }
    { "type": "call_end",       "target_user_id": "..." }
    { "type": "ping" }

  Сервер → Клиент:
    { "type": "new_message",    "message": { ...MessageOut } }
    { "type": "message_edited", "message": { ...MessageOut } }
    { "type": "message_deleted","message_id": "...", "chat_id": "..." }
    { "type": "typing",         "chat_id": "...", "user_id": "...", "action": "start"|"stop" }
    { "type": "read_receipt",   "chat_id": "...", "message_id": "...", "user_id": "...", "read_at": "..." }
    { "type": "member_added",   "chat_id": "...", "user_id": "...", "added_by": "..." }
    { "type": "user_online",    "user_id": "...", "is_online": true|false }
    { "type": "call_offer",     "from_user_id": "...", "from_user_name": "...", "offer": {...}, "is_video": bool, "chat_id": "..." }
    { "type": "call_answer",    "from_user_id": "...", "answer": {...} }
    { "type": "ice_candidate",  "from_user_id": "...", "candidate": {...} }
    { "type": "call_end",       "from_user_id": "..." }
    { "type": "pong" }
    { "type": "error",          "detail": "..." }
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.redis import get_redis
from app.core.security import verify_token
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.models.chat import Chat, ChatMember, ChatType, MemberRole
from app.models.message import Message, MessageType
from app.schemas.message import MessageOut
from app.services import chat_service

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_uuid(value) -> uuid.UUID | None:
    """Разобрать UUID, не роняя WS-соединение исключением."""
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None


# ---------- Redis PubSub Listener ----------

async def redis_listener(user_id: str, ws: WebSocket):
    """Подписаться на Redis-канал пользователя и форвардить сообщения в WS."""
    redis = await get_redis()
    channel = f"user:{user_id}"
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel)
    try:
        async for msg in pubsub.listen():
            if msg["type"] == "message":
                try:
                    data = json.loads(msg["data"])
                except (json.JSONDecodeError, TypeError):
                    logger.warning("bad redis payload on channel %s", channel)
                    continue
                try:
                    await ws.send_json(data)
                except (WebSocketDisconnect, RuntimeError):
                    # Сокет закрыт или упал — завершаем слушатель
                    break
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    except Exception:
        logger.exception("redis_listener error")
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
        except Exception:
            pass


async def publish_to_user(user_id: str, payload: dict):
    """Опубликовать событие в Redis-канал пользователя (работает между процессами)."""
    try:
        redis = await get_redis()
        await redis.publish(f"user:{user_id}", json.dumps(payload))
    except Exception:
        # Без Redis события не доставляются, но соединение не должно падать
        logger.exception("publish_to_user failed")


# ---------- Broadcast helpers ----------

async def broadcast_to_chat(chat_id: str, payload: dict, db: AsyncSession):
    """Отправить событие всем участникам чата."""
    chat_uuid = _parse_uuid(chat_id)
    if not chat_uuid:
        return

    result = await db.execute(
        select(ChatMember.user_id).where(ChatMember.chat_id == chat_uuid)
    )
    member_ids = [str(r) for r in result.scalars().all()]
    for uid in member_ids:
        await publish_to_user(uid, payload)


async def _get_membership(
    chat_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession
) -> tuple[ChatMember, Chat] | None:
    """Вернуть (участник, чат) или None, если пользователь не в чате."""
    result = await db.execute(
        select(ChatMember, Chat)
        .join(Chat, Chat.id == ChatMember.chat_id)
        .where(ChatMember.chat_id == chat_id, ChatMember.user_id == user_id)
    )
    return result.first()


async def notify_presence(
    user_id: str, is_online: bool, db: AsyncSession, last_seen: datetime | None = None
):
    """Разослать всем, у кого есть общий чат, событие user_online."""
    user_uuid = _parse_uuid(user_id)
    if not user_uuid:
        return

    result = await db.execute(
        select(ChatMember.user_id)
        .where(
            ChatMember.chat_id.in_(
                select(ChatMember.chat_id).where(ChatMember.user_id == user_uuid)
            ),
            ChatMember.user_id != user_uuid,
        )
        .distinct()
    )
    payload = {
        "type": "user_online",
        "user_id": user_id,
        "is_online": is_online,
        "last_seen": last_seen.isoformat() if last_seen else None,
    }
    for uid in result.scalars().all():
        await publish_to_user(str(uid), payload)


# ---------- Message handling ----------

async def handle_send_message(data: dict, user: User, db: AsyncSession):
    chat_id = _parse_uuid(data.get("chat_id"))
    content = (data.get("content") or "").strip()

    if not chat_id or not content:
        return {"type": "error", "detail": "chat_id и content обязательны"}

    membership = await _get_membership(chat_id, user.id, db)
    if not membership:
        return {"type": "error", "detail": "Нет доступа к чату"}

    member, chat = membership
    if chat.type == ChatType.channel and member.role == MemberRole.member:
        return {"type": "error", "detail": "Только администраторы могут писать в канал"}

    reply_to_id = _parse_uuid(data.get("reply_to_id"))
    if data.get("reply_to_id") and not reply_to_id:
        return {"type": "error", "detail": "Некорректный reply_to_id"}

    if reply_to_id:
        from app.services.message_service import validate_reply_to

        try:
            await validate_reply_to(reply_to_id, chat_id, db)
        except Exception as exc:
            detail = getattr(exc, "detail", "Некорректный ответ")
            return {"type": "error", "detail": detail}

    msg = Message(
        chat_id=chat_id,
        sender_id=user.id,
        content=content,
        type=MessageType.text,
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
    return None


async def handle_typing(data: dict, user: User, action: str, db: AsyncSession):
    chat_id = _parse_uuid(data.get("chat_id"))
    if not chat_id:
        return

    if not await _get_membership(chat_id, user.id, db):
        return

    await broadcast_to_chat(
        str(chat_id),
        {
            "type": "typing",
            "chat_id": str(chat_id),
            "user_id": str(user.id),
            "action": action,
        },
        db,
    )


async def handle_read(data: dict, user: User, db: AsyncSession):
    chat_id = _parse_uuid(data.get("chat_id"))
    if not chat_id:
        return

    membership = await _get_membership(chat_id, user.id, db)
    if not membership:
        return

    member, _ = membership
    message_id = _parse_uuid(data.get("message_id"))
    now = _utcnow()

    member.last_read_at = now
    if message_id:
        member.last_read_message_id = message_id
    await db.commit()

    await broadcast_to_chat(
        str(chat_id),
        {
            "type": "read_receipt",
            "chat_id": str(chat_id),
            "message_id": str(message_id) if message_id else None,
            "user_id": str(user.id),
            "read_at": now.isoformat(),
        },
        db,
    )


async def handle_reaction(data: dict, user: User, db: AsyncSession) -> dict | None:
    """Обработка реакции на сообщение (добавить/удалить)."""
    chat_id = _parse_uuid(data.get("chat_id"))
    message_id = _parse_uuid(data.get("message_id"))
    emoji = data.get("emoji")
    if not chat_id or not message_id or not emoji:
        return {"type": "error", "detail": "chat_id, message_id и emoji обязательны"}

    from app.services.message_service import toggle_reaction
    try:
        await toggle_reaction(chat_id, message_id, user.id, emoji, db)
    except Exception as e:
        return {"type": "error", "detail": str(e)}
    return None


# ---------- Call signaling ----------

async def handle_call_signal(
    data: dict, user: User, msg_type: str, db: AsyncSession
) -> dict | None:
    """
    Сигналинг WebRTC. Проверяем, что отправитель и цель состоят
    в одном приватном чате, иначе любой мог бы слать произвольному
    пользователю offer / answer / ice_candidate.
    """
    target_id = _parse_uuid(data.get("target_user_id"))
    if not target_id:
        return {"type": "error", "detail": "Некорректный target_user_id"}

    if target_id == user.id:
        return {"type": "error", "detail": "Нельзя позвонить самому себе"}

    common_chat = await db.execute(
        select(Chat)
        .join(ChatMember, Chat.id == ChatMember.chat_id)
        .where(
            Chat.type == ChatType.private,
            ChatMember.user_id == user.id,
            Chat.id.in_(
                select(ChatMember.chat_id).where(ChatMember.user_id == target_id)
            ),
        )
        .limit(1)
    )
    shared_chat = common_chat.scalar_one_or_none()
    if not shared_chat:
        return {"type": "error", "detail": "Нет общего чата с этим пользователем"}

    chat_id = _parse_uuid(data.get("chat_id"))
    if chat_id and chat_id != shared_chat.id:
        return {"type": "error", "detail": "Некорректный chat_id"}

    target = await db.get(User, target_id)
    if not target:
        return {"type": "error", "detail": "Пользователь не найден"}

    payload: dict = {
        "type": msg_type,
        "from_user_id": str(user.id),
        "chat_id": str(shared_chat.id),
    }

    if msg_type == "call_offer":
        payload["from_user_name"] = user.display_name or user.phone
        payload["offer"] = data.get("offer")
        payload["is_video"] = bool(data.get("is_video", False))
    elif msg_type == "call_answer":
        payload["answer"] = data.get("answer")
    elif msg_type == "ice_candidate":
        payload["candidate"] = data.get("candidate")
    elif msg_type == "call_end":
        # причина завершения: отмена, отбой, занято
        payload["reason"] = data.get("reason") or "ended"
    elif msg_type == "media_state":
        payload["is_video_enabled"] = bool(data.get("is_video_enabled", False))
        payload["is_audio_enabled"] = bool(data.get("is_audio_enabled", True))
        payload["is_screen_sharing"] = bool(data.get("is_screen_sharing", False))

    await publish_to_user(str(target_id), payload)
    return None


async def handle_pin_message(data: dict, user: User, db: AsyncSession):
    """Закрепить или открепить сообщение в чате."""
    chat_id = _parse_uuid(data.get("chat_id"))
    msg_id = _parse_uuid(data.get("message_id"))
    if not chat_id:
        return {"type": "error", "detail": "Не указан chat_id"}
    try:
        chat = await chat_service.pin_message(chat_id, msg_id, user, db)
        pinned_out = (
            MessageOut.model_validate(chat.pinned_message).model_dump(mode="json")
            if chat.pinned_message
            else None
        )
        await broadcast_to_chat(
            str(chat_id),
            {
                "type": "chat_pinned_message",
                "chat_id": str(chat_id),
                "pinned_message_id": str(msg_id) if msg_id else None,
                "pinned_message": pinned_out,
            },
            db,
        )
        return None
    except Exception as e:
        return {"type": "error", "detail": str(e)}


# ---------- Main WS endpoint ----------

async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """Точка входа для WebSocket соединений. URL: ws://host/ws?token=<jwt>"""

    # Аутентификация
    payload = verify_token(token, "access")
    if not payload:
        await websocket.accept()
        await websocket.close(code=4001, reason="Unauthorized")
        return

    user_id = payload.get("sub")
    parsed_uid = _parse_uuid(user_id)
    await websocket.accept()

    if not parsed_uid:
        await websocket.close(code=4004, reason="Invalid user id")
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == parsed_uid))
        user = result.scalar_one_or_none()
        if not user:
            await websocket.close(code=4004, reason="User not found")
            return

        # Подписка на Redis-канал ДО статуса online,
        # чтобы не пропустить входящие сообщения
        listener_task = asyncio.create_task(redis_listener(str(parsed_uid), websocket))

        # Считаем активные соединения (вкладки) — offline только при закрытии последней.
        # TTL продлевается ping'ами, поэтому если процесс умрёт без finally,
        # счётчик сам истечёт и не оставит пользователя "офлайн навсегда".
        try:
            redis_conn = await get_redis()
            await redis_conn.incr(f"user_connections:{parsed_uid}")
            await redis_conn.expire(f"user_connections:{parsed_uid}", 120)
        except Exception:
            logger.exception("presence increment failed")

        was_offline = not user.is_online
        user.is_online = True
        await db.commit()
        if was_offline:
            await notify_presence(str(parsed_uid), True, db)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "detail": "Неверный JSON"})
                continue

            msg_type = data.get("type")

            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.id == parsed_uid))
                user = result.scalar_one()
                if not user:
                    break

                if msg_type == "send_message":
                    err = await handle_send_message(data, user, db)
                    if err:
                        await websocket.send_json(err)

                elif msg_type == "typing_start":
                    await handle_typing(data, user, "start", db)

                elif msg_type == "typing_stop":
                    await handle_typing(data, user, "stop", db)

                elif msg_type == "read":
                    await handle_read(data, user, db)

                elif msg_type == "reaction":
                    err = await handle_reaction(data, user, db)
                    if err:
                        await websocket.send_json(err)

                elif msg_type == "pin_message":
                    err = await handle_pin_message(data, user, db)
                    if err:
                        await websocket.send_json(err)

                elif msg_type in ("call_offer", "call_answer", "ice_candidate", "call_end", "media_state"):
                    err = await handle_call_signal(data, user, msg_type, db)
                    if err:
                        await websocket.send_json(err)

                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    # Продлеваем TTL presence-счётчика вместе с keepalive-ping'ом
                    try:
                        ping_redis = await get_redis()
                        await ping_redis.expire(f"user_connections:{parsed_uid}", 120)
                    except Exception:
                        logger.exception("presence expire failed")

    except WebSocketDisconnect:
        pass
    finally:
        listener_task.cancel()

        # Уменьшаем счётчик соединений (вкладок) и переходим в offline
        # только когда закрылось последнее соединение пользователя.
        remaining = None
        try:
            redis = await get_redis()
            remaining = await redis.decr(f"user_connections:{parsed_uid}")
            if remaining <= 0:
                await redis.delete(f"user_connections:{parsed_uid}")
        except Exception:
            logger.exception("presence decrement failed")

        if remaining is None or remaining <= 0:
            now_ts = _utcnow()
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(User).where(User.id == parsed_uid))
                user = result.scalar_one_or_none()
                if user:
                    user.is_online = False
                    user.last_seen = now_ts
                    await db.commit()

                await notify_presence(str(parsed_uid), False, db, last_seen=now_ts)
