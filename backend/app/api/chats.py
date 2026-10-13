import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel
from app.core.database import get_db
from app.models.user import User
from app.models.chat import MemberRole
from app.schemas.chat import (
    ChatCreate,
    ChatOut,
    ChatRoleCreate,
    ChatRoleUpdate,
    ChatRoleOut,
    MemberRoleUpdate,
)
from app.services import chat_service
from app.services.deps import get_current_user

router = APIRouter(prefix="/chats", tags=["Чаты"])

@router.get("", response_model=list[ChatOut])
async def list_chats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список всех чатов текущего пользователя."""
    return await chat_service.get_user_chats(current_user.id, db)


@router.post("", response_model=ChatOut)
async def create_chat(
    data: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать новый чат (личный, групповой или канал)."""
    return await chat_service.create_chat(data, current_user, db)


@router.get("/{chat_id}", response_model=ChatOut)
async def get_chat(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить информацию о чате."""
    return await chat_service.get_chat(chat_id, current_user.id, db)


@router.post("/{chat_id}/members/{user_id}")
async def add_member(
    chat_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Добавить участника в групповой чат."""
    await chat_service.add_member(chat_id, user_id, current_user, db)
    return {"detail": "Участник добавлен"}


@router.delete("/{chat_id}/members/{user_id}")
async def remove_member(
    chat_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удалить участника из группового чата или покинуть чат."""
    await chat_service.remove_member(chat_id, user_id, current_user, db)
    return {"detail": "Участник удален"}


@router.patch("/{chat_id}/members/{user_id}/role", response_model=ChatOut)
async def update_member_role(
    chat_id: uuid.UUID,
    user_id: uuid.UUID,
    data: MemberRoleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Изменить роль, кастомную роль или права участника."""
    return await chat_service.update_member_role(chat_id, user_id, data, current_user, db)


@router.get("/{chat_id}/roles", response_model=list[ChatRoleOut])
async def list_chat_roles(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить список кастомных ролей чата."""
    return await chat_service.list_chat_roles(chat_id, current_user, db)


@router.post("/{chat_id}/roles", response_model=ChatRoleOut)
async def create_chat_role(
    chat_id: uuid.UUID,
    data: ChatRoleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать новую кастомную роль в чате."""
    return await chat_service.create_chat_role(chat_id, data, current_user, db)


@router.patch("/{chat_id}/roles/{role_id}", response_model=ChatRoleOut)
async def update_chat_role(
    chat_id: uuid.UUID,
    role_id: uuid.UUID,
    data: ChatRoleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Изменить настройки или права кастомной роли."""
    return await chat_service.update_chat_role(chat_id, role_id, data, current_user, db)


@router.delete("/{chat_id}/roles/{role_id}")
async def delete_chat_role(
    chat_id: uuid.UUID,
    role_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удалить кастомную роль из чата."""
    await chat_service.delete_chat_role(chat_id, role_id, current_user, db)
    return {"detail": "Роль удалена"}


@router.post("/{chat_id}/read")
async def mark_chat_read(
    chat_id: uuid.UUID,
    message_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Отметить все сообщения в чате как прочитанные."""
    read_at = await chat_service.mark_chat_read(chat_id, current_user.id, db, message_id)
    return {"status": "ok", "read_at": read_at.isoformat()}


@router.post("/{chat_id}/pin/{message_id}", response_model=ChatOut)
async def pin_message(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Закрепить сообщение в чате."""
    chat = await chat_service.pin_message(chat_id, message_id, current_user, db)
    from app.ws.gateway import broadcast_to_chat
    from app.schemas.message import MessageOut

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
            "pinned_message_id": str(message_id),
            "pinned_message": pinned_out,
        },
        db,
    )
    return chat


@router.delete("/{chat_id}/pin", response_model=ChatOut)
async def unpin_message(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Открепить сообщение в чате."""
    chat = await chat_service.pin_message(chat_id, None, current_user, db)
    from app.ws.gateway import broadcast_to_chat

    await broadcast_to_chat(
        str(chat_id),
        {
            "type": "chat_pinned_message",
            "chat_id": str(chat_id),
            "pinned_message_id": None,
            "pinned_message": None,
        },
        db,
    )
    return chat
