from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.auth import SendCodeRequest, VerifyCodeRequest, TokenResponse, RefreshRequest
from app.services import auth_service
from app.core.database import get_db

router = APIRouter(prefix="/auth", tags=["Авторизация"])


@router.post("/send-code")
async def send_code(request: SendCodeRequest, db: AsyncSession = Depends(get_db)):
    """Отправить SMS-код на номер телефона."""
    return await auth_service.send_code(request, db)


@router.post("/verify", response_model=TokenResponse)
async def verify_code(request: VerifyCodeRequest, db: AsyncSession = Depends(get_db)):
    """Проверить SMS-код и получить токены доступа."""
    return await auth_service.verify_code(request, db)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: RefreshRequest):
    """Обновить access token по refresh token."""
    return await auth_service.refresh_tokens(request.refresh_token)
