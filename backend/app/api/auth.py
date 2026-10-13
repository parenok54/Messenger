from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.auth import (
    SendCodeRequest,
    VerifyCodeRequest,
    TokenResponse,
    RefreshRequest,
    LoginPasswordRequest,
    RegisterPasswordRequest,
    DemoLoginRequest,
)
from app.services import auth_service
from app.services.deps import get_current_user
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Авторизация"])


@router.post("/send-code")
async def send_code(request: SendCodeRequest, db: AsyncSession = Depends(get_db)):
    """Отправить SMS-код на номер телефона."""
    return await auth_service.send_code(request, db)


@router.post("/verify", response_model=TokenResponse)
async def verify_code(request: VerifyCodeRequest, db: AsyncSession = Depends(get_db)):
    """Проверить SMS-код и получить токены доступа."""
    return await auth_service.verify_code(request, db)


@router.post("/login-password", response_model=TokenResponse)
async def login_password(request: LoginPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Вход по имени пользователя / телефону / email и паролю."""
    return await auth_service.login_with_password(request, db)


@router.post("/register-password", response_model=TokenResponse)
async def register_password(request: RegisterPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Регистрация нового пользователя с логином и паролем."""
    return await auth_service.register_with_password(request, db)


@router.post("/demo-login", response_model=TokenResponse)
async def demo_login(request: DemoLoginRequest, db: AsyncSession = Depends(get_db)):
    """Быстрый вход под тестовым аккаунтом (alex, anna, guest)."""
    return await auth_service.demo_login(request.user_type, db)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: RefreshRequest):
    """Обновить access token по refresh token."""
    return await auth_service.refresh_tokens(request.refresh_token)


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Отозвать refresh токен и завершить сессию."""
    await auth_service.logout_user(str(current_user.id))
    return {"detail": "Сессия успешно завершена"}
