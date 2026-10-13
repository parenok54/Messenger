import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.chat import Chat, ChatMember, ChatRole, ChatType, MemberRole
from app.models.message import Message
from app.models.user import User
from app.schemas.chat import ChatCreate, ChatRoleCreate, ChatRoleUpdate, MemberRoleUpdate


def has_permission(member: ChatMember, perm_name: str) -> bool:
    """Проверяет наличие прав у участника (владелец, прямое право или через роль)."""
    if member.role == MemberRole.owner:
        return True
    # Прямой флаг на участнике
    if getattr(member, perm_name, False):
        return True
    # Флаг из кастомной роли
    if member.custom_role and getattr(member.custom_role, perm_name, False):
        return True
    # Дефолтные права для администратора (за исключением управления ролями!)
    if member.role == MemberRole.admin:
        if perm_name == "can_manage_roles":
            return False  # Обычный администратор НЕ может управлять ролями без специального разрешения!
        if perm_name in ("can_manage_members", "can_delete_messages", "can_pin_messages", "can_post_messages"):
            return True
    return False


async def _load_chat_with_members(chat_id: uuid.UUID, db: AsyncSession) -> Chat:
    """Загружает чат с участниками и их профилями (избегает lazy-load)."""
    result = await db.execute(
        select(Chat)
        .where(Chat.id == chat_id)
        .options(
            selectinload(Chat.members).selectinload(ChatMember.user),
            selectinload(Chat.members).selectinload(ChatMember.custom_role),
            selectinload(Chat.roles),
            selectinload(Chat.pinned_message).selectinload(Message.sender),
            selectinload(Chat.pinned_message).selectinload(Message.reactions),
        )
    )
    return result.scalar_one()


async def create_chat(data: ChatCreate, current_user: User, db: AsyncSession) -> Chat:
    if data.type == ChatType.private:
        if len(data.member_ids) != 1:
            raise HTTPException(400, "Личный чат должен содержать ровно 1 собеседника")
        other_id = data.member_ids[0]
        if other_id == current_user.id:
            raise HTTPException(400, "Нельзя создать чат с самим собой")

        # Проверить, существует ли уже личный чат
        existing = await db.execute(
            select(Chat)
            .join(ChatMember, Chat.id == ChatMember.chat_id)
            .where(
                Chat.type == ChatType.private,
                ChatMember.user_id == current_user.id,
            )
            .where(
                Chat.id.in_(
                    select(ChatMember.chat_id).where(ChatMember.user_id == other_id)
                )
            )
            .options(selectinload(Chat.members).selectinload(ChatMember.user))
            .limit(1)
        )
        existing_row = existing.first()
        if existing_row:
            return existing_row[0]

    chat = Chat(type=data.type, title=data.title, description=data.description, created_by=current_user.id)
    db.add(chat)
    await db.flush()

    # Добавить создателя
    db.add(ChatMember(chat_id=chat.id, user_id=current_user.id, role=MemberRole.owner))

    # Добавить остальных участников
    for member_id in data.member_ids:
        result = await db.execute(select(User).where(User.id == member_id))
        if not result.scalar_one_or_none():
            raise HTTPException(404, f"Пользователь {member_id} не найден")
        db.add(ChatMember(chat_id=chat.id, user_id=member_id, role=MemberRole.member))

    await db.commit()
    # Перезагрузить с явным selectinload чтобы не было MissingGreenlet при сериализации
    return await _load_chat_with_members(chat.id, db)


async def get_user_chats(user_id: uuid.UUID, db: AsyncSession) -> list[Chat]:
    result = await db.execute(
        select(Chat)
        .join(ChatMember, Chat.id == ChatMember.chat_id)
        .where(ChatMember.user_id == user_id)
        .options(
            selectinload(Chat.members).selectinload(ChatMember.user),
            selectinload(Chat.members).selectinload(ChatMember.custom_role),
            selectinload(Chat.roles),
            selectinload(Chat.pinned_message).selectinload(Message.sender),
            selectinload(Chat.pinned_message).selectinload(Message.reactions),
        )
        .order_by(desc(Chat.created_at))
    )
    chats = result.scalars().unique().all()
    if not chats:
        return []

    chat_ids = [chat.id for chat in chats]

    # Последнее сообщение каждого чата одним запросом (DISTINCT ON)
    last_messages_res = await db.execute(
        select(Message)
        .where(
            Message.chat_id.in_(chat_ids),
            Message.is_deleted == False,  # noqa: E712
        )
        .options(
            selectinload(Message.sender),
            selectinload(Message.reply_to).selectinload(Message.sender),
            selectinload(Message.reactions),
        )
        .distinct(Message.chat_id)
        .order_by(Message.chat_id, desc(Message.created_at))
    )
    last_messages = {msg.chat_id: msg for msg in last_messages_res.scalars().all()}

    # Счётчики непрочитанных одним запросом с учётом last_read_at участника
    unread_res = await db.execute(
        select(Message.chat_id, func.count(Message.id))
        .join(
            ChatMember,
            and_(
                ChatMember.chat_id == Message.chat_id,
                ChatMember.user_id == user_id,
            ),
        )
        .where(
            Message.is_deleted == False,  # noqa: E712
            Message.sender_id != user_id,
            or_(
                ChatMember.last_read_at.is_(None),
                Message.created_at > ChatMember.last_read_at,
            ),
        )
        .group_by(Message.chat_id)
    )
    unread_counts = {chat_id: count for chat_id, count in unread_res.all()}

    for chat in chats:
        chat.last_message = last_messages.get(chat.id)
        chat.unread_count = unread_counts.get(chat.id, 0)

    return chats


async def get_chat(chat_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession) -> Chat:
    result = await db.execute(
        select(Chat)
        .where(Chat.id == chat_id)
        .options(
            selectinload(Chat.members).selectinload(ChatMember.user),
            selectinload(Chat.members).selectinload(ChatMember.custom_role),
            selectinload(Chat.roles),
            selectinload(Chat.pinned_message).selectinload(Message.sender),
            selectinload(Chat.pinned_message).selectinload(Message.reactions),
        )
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(404, "Чат не найден")

    # Проверить доступ
    member_ids = {m.user_id for m in chat.members}
    if user_id not in member_ids:
        raise HTTPException(403, "Нет доступа к этому чату")

    return chat


async def pin_message(
    chat_id: uuid.UUID,
    message_id: uuid.UUID | None,
    current_user: User,
    db: AsyncSession,
) -> Chat:
    chat = await get_chat(chat_id, current_user.id, db)
    if message_id is not None:
        msg_res = await db.execute(
            select(Message)
            .where(
                Message.id == message_id,
                Message.chat_id == chat_id,
                Message.is_deleted == False,
            )
            .options(
                selectinload(Message.sender),
                selectinload(Message.reactions),
            )
        )
        msg = msg_res.scalar_one_or_none()
        if not msg:
            raise HTTPException(404, "Сообщение не найдено в этом чате")
        chat.pinned_message_id = message_id
    else:
        chat.pinned_message_id = None

    await db.commit()
    return await get_chat(chat_id, current_user.id, db)


async def add_member(chat_id: uuid.UUID, user_id: uuid.UUID, current_user: User, db: AsyncSession):
    chat = await get_chat(chat_id, current_user.id, db)
    if chat.type == ChatType.private:
        raise HTTPException(400, "Нельзя добавить участника в личный чат")

    # Проверить права текущего пользователя
    current_member = next((m for m in chat.members if m.user_id == current_user.id), None)
    if not current_member or not has_permission(current_member, "can_manage_members"):
        raise HTTPException(403, "У вас нет прав на добавление участников")

    result = await db.execute(select(User).where(User.id == user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Пользователь не найден")

    # Уже участник? Идемпотентность вместо ошибки первичного ключа
    already_member = await db.execute(
        select(ChatMember).where(
            ChatMember.chat_id == chat_id, ChatMember.user_id == user_id
        )
    )
    if already_member.scalar_one_or_none():
        raise HTTPException(400, "Пользователь уже состоит в этом чате")

    db.add(ChatMember(chat_id=chat_id, user_id=user_id, role=MemberRole.member))
    await db.commit()

    # Оповещаем участников чата через WS
    from app.ws.gateway import broadcast_to_chat

    await broadcast_to_chat(
        str(chat_id),
        {
            "type": "member_added",
            "chat_id": str(chat_id),
            "user_id": str(user_id),
            "added_by": str(current_user.id),
        },
        db,
    )


async def remove_member(
    chat_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
):
    chat = await get_chat(chat_id, current_user.id, db)
    if chat.type == ChatType.private:
        raise HTTPException(400, "Нельзя удалить участника из личного чата")

    target_member = next((m for m in chat.members if m.user_id == user_id), None)
    if not target_member:
        raise HTTPException(404, "Участник не найден в этом чате")

    current_member = next((m for m in chat.members if m.user_id == current_user.id), None)
    if not current_member:
        raise HTTPException(403, "Вы не являетесь участником чата")

    if current_user.id == user_id:
        if current_member.role == MemberRole.owner and len(chat.members) > 1:
            raise HTTPException(400, "Владелец не может покинуть чат, пока не передаст права")
    else:
        if not has_permission(current_member, "can_manage_members"):
            raise HTTPException(403, "У вас нет прав на удаление участников")
        if target_member.role == MemberRole.owner:
            raise HTTPException(403, "Нельзя удалить владельца чата")
        if current_member.role == MemberRole.admin and target_member.role == MemberRole.admin:
            if not has_permission(current_member, "can_manage_roles"):
                raise HTTPException(403, "Администратор не может удалить другого администратора")

    await db.delete(target_member)
    await db.commit()

    from app.ws.gateway import broadcast_to_chat

    await broadcast_to_chat(
        str(chat_id),
        {
            "type": "member_removed",
            "chat_id": str(chat_id),
            "user_id": str(user_id),
            "removed_by": str(current_user.id),
        },
        db,
    )


async def update_member_role(
    chat_id: uuid.UUID,
    user_id: uuid.UUID,
    role_update: MemberRoleUpdate,
    current_user: User,
    db: AsyncSession,
):
    chat = await get_chat(chat_id, current_user.id, db)
    if chat.type == ChatType.private:
        raise HTTPException(400, "В личном чате нет ролей")

    current_member = next((m for m in chat.members if m.user_id == current_user.id), None)
    if not current_member or not has_permission(current_member, "can_manage_roles"):
        raise HTTPException(403, "Только владелец или администраторы со специальными правами могут изменять роли и права")

    target_member = next((m for m in chat.members if m.user_id == user_id), None)
    if not target_member:
        raise HTTPException(404, "Участник не найден")

    if target_member.user_id == current_user.id:
        raise HTTPException(400, "Нельзя изменить собственную роль")

    if target_member.role == MemberRole.owner:
        raise HTTPException(403, "Нельзя изменить роль владельца чата")

    # Если текущий пользователь не владелец, он не может назначать владельца или выдавать право управления ролями
    if current_member.role != MemberRole.owner:
        if role_update.role == MemberRole.owner:
            raise HTTPException(403, "Только владелец может передать права владельца")
        if role_update.can_manage_roles is True:
            raise HTTPException(403, "Только владелец чата может наделять правом управления ролями")

    if role_update.role is not None:
        target_member.role = role_update.role

    # Привязка кастомной роли
    if role_update.custom_role_id is not None:
        if role_update.custom_role_id == uuid.UUID(int=0):
            target_member.custom_role_id = None
        else:
            role_exists = any(r.id == role_update.custom_role_id for r in chat.roles)
            if not role_exists:
                raise HTTPException(404, "Кастомная роль не найдена в этом чате")
            target_member.custom_role_id = role_update.custom_role_id
    elif "custom_role_id" in role_update.model_fields_set and role_update.custom_role_id is None:
        target_member.custom_role_id = None

    if role_update.custom_title is not None:
        target_member.custom_title = role_update.custom_title

    # Точечные разрешения
    for field in ("can_manage_roles", "can_manage_members", "can_delete_messages", "can_pin_messages", "can_change_info", "can_post_messages"):
        val = getattr(role_update, field)
        if val is not None:
            setattr(target_member, field, val)

    await db.commit()

    from app.ws.gateway import broadcast_to_chat

    await broadcast_to_chat(
        str(chat_id),
        {
            "type": "member_role_changed",
            "chat_id": str(chat_id),
            "user_id": str(user_id),
            "new_role": target_member.role.value,
        },
        db,
    )
    return await get_chat(chat_id, current_user.id, db)


async def list_chat_roles(chat_id: uuid.UUID, current_user: User, db: AsyncSession) -> list[ChatRole]:
    chat = await get_chat(chat_id, current_user.id, db)
    return chat.roles


async def create_chat_role(chat_id: uuid.UUID, data: ChatRoleCreate, current_user: User, db: AsyncSession) -> ChatRole:
    chat = await get_chat(chat_id, current_user.id, db)
    if chat.type == ChatType.private:
        raise HTTPException(400, "В личном чате нет кастомных ролей")

    current_member = next((m for m in chat.members if m.user_id == current_user.id), None)
    if not current_member or not has_permission(current_member, "can_manage_roles"):
        raise HTTPException(403, "У вас нет прав на создание кастомных ролей")

    if data.can_manage_roles and current_member.role != MemberRole.owner:
        raise HTTPException(403, "Только владелец может создавать роли с правом управления ролями")

    new_role = ChatRole(
        chat_id=chat_id,
        name=data.name.strip(),
        color=data.color or "#2AABEE",
        can_manage_roles=data.can_manage_roles,
        can_manage_members=data.can_manage_members,
        can_delete_messages=data.can_delete_messages,
        can_pin_messages=data.can_pin_messages,
        can_change_info=data.can_change_info,
        can_post_messages=data.can_post_messages,
        position=data.position or len(chat.roles),
    )
    db.add(new_role)
    await db.commit()
    await db.refresh(new_role)

    from app.ws.gateway import broadcast_to_chat
    await broadcast_to_chat(
        str(chat_id),
        {"type": "chat_roles_updated", "chat_id": str(chat_id)},
        db,
    )
    return new_role


async def update_chat_role(
    chat_id: uuid.UUID, role_id: uuid.UUID, data: ChatRoleUpdate, current_user: User, db: AsyncSession
) -> ChatRole:
    chat = await get_chat(chat_id, current_user.id, db)
    current_member = next((m for m in chat.members if m.user_id == current_user.id), None)
    if not current_member or not has_permission(current_member, "can_manage_roles"):
        raise HTTPException(403, "У вас нет прав на редактирование ролей")

    role = next((r for r in chat.roles if r.id == role_id), None)
    if not role:
        raise HTTPException(404, "Роль не найдена")

    if data.can_manage_roles is not None and data.can_manage_roles != role.can_manage_roles:
        if current_member.role != MemberRole.owner:
            raise HTTPException(403, "Только владелец может изменять право управления ролями")

    for field, val in data.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(role, field, val)

    await db.commit()
    await db.refresh(role)

    from app.ws.gateway import broadcast_to_chat
    await broadcast_to_chat(
        str(chat_id),
        {"type": "chat_roles_updated", "chat_id": str(chat_id)},
        db,
    )
    return role


async def delete_chat_role(
    chat_id: uuid.UUID, role_id: uuid.UUID, current_user: User, db: AsyncSession
):
    chat = await get_chat(chat_id, current_user.id, db)
    current_member = next((m for m in chat.members if m.user_id == current_user.id), None)
    if not current_member or not has_permission(current_member, "can_manage_roles"):
        raise HTTPException(403, "У вас нет прав на удаление ролей")

    role = next((r for r in chat.roles if r.id == role_id), None)
    if not role:
        raise HTTPException(404, "Роль не найдена")

    await db.delete(role)
    await db.commit()

    from app.ws.gateway import broadcast_to_chat
    await broadcast_to_chat(
        str(chat_id),
        {"type": "chat_roles_updated", "chat_id": str(chat_id)},
        db,
    )


async def mark_chat_read(
    chat_id: uuid.UUID, user_id: uuid.UUID, db: AsyncSession, message_id: uuid.UUID | None = None
) -> datetime:
    """Отметить чат прочитанным и разослать read_receipt участникам."""
    result = await db.execute(
        select(ChatMember).where(
            ChatMember.chat_id == chat_id, ChatMember.user_id == user_id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(403, "Нет доступа к чату")

    now = datetime.now(timezone.utc)
    member.last_read_at = now
    if message_id:
        member.last_read_message_id = message_id
    await db.commit()

    from app.ws.gateway import broadcast_to_chat

    await broadcast_to_chat(
        str(chat_id),
        {
            "type": "read_receipt",
            "chat_id": str(chat_id),
            "user_id": str(user_id),
            "message_id": str(message_id) if message_id else None,
            "read_at": now.isoformat(),
        },
        db,
    )
    return now
