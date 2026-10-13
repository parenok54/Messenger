import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.core.config import settings
from app.core.database import get_db
from app.core.storage import upload_file
from app.models.user import User
from app.schemas.user import UserOut, UserPublic, UserUpdate
from app.services.deps import get_current_user


def _escape_like(value: str) -> str:
    """Экранировать % _ \\ чтобы пользователь не сломал LIKE-шаблон."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

router = APIRouter(prefix="/users", tags=["Пользователи"])


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    """Получить свой профиль."""
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить свой профиль."""
    update_data = data.model_dump(exclude_unset=True)
    
    if "username" in update_data and update_data["username"]:
        username = update_data["username"].strip().lower()
        if len(username) < 3 or len(username) > 32:
            raise HTTPException(400, "Username должен быть от 3 до 32 символов")
        # Проверяем уникальность
        existing = await db.execute(
            select(User).where(User.username == username, User.id != current_user.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(400, "Такой username уже занят")
        update_data["username"] = username

    for field, value in update_data.items():
        setattr(current_user, field, value)
        
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Загрузить аватар."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Только изображения")
    data = await file.read()
    if len(data) > settings.MAX_AVATAR_SIZE:
        raise HTTPException(400, "Файл слишком большой (макс. 5 МБ)")
    if not data:
        raise HTTPException(400, "Пустой файл")

    url = await upload_file(data, file.filename, file.content_type)
    current_user.avatar_url = url
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/search", response_model=list[UserPublic])
async def search_users(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Поиск пользователей по username или имени."""
    if len(q) < 2:
        raise HTTPException(400, "Минимум 2 символа")

    pattern = f"%{_escape_like(q)}%"
    result = await db.execute(
        select(User).where(
            or_(
                User.username.ilike(pattern, escape="\\"),
                User.display_name.ilike(pattern, escape="\\"),
            ),
            User.id != current_user.id,
        ).limit(20)
    )
    return result.scalars().all()


@router.get("/{user_id}", response_model=UserPublic)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Получить публичный профиль пользователя."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    return user
