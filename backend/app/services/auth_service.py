import secrets
import string
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import phonenumbers

from app.models.user import User
from app.schemas.auth import SendCodeRequest, VerifyCodeRequest, TokenResponse
from app.core.security import create_access_token, create_refresh_token, verify_token
from app.core.redis import get_redis
from app.core.config import settings


OTP_TTL_SECONDS = 300  # 5 минут


def _normalize_phone(phone: str) -> str:
    try:
        parsed = phonenumbers.parse(phone, None)
        if not phonenumbers.is_valid_number(parsed):
            raise ValueError
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        raise HTTPException(status_code=400, detail="Неверный формат номера телефона")


def _generate_otp() -> str:
    # secrets вместо random: код подвергается перебору, нужен CSPRNG
    return "".join(secrets.choice(string.digits) for _ in range(6))


async def _send_sms(phone: str, code: str):
    """Отправить SMS с кодом. В DEV режиме — просто выводим в лог."""
    if settings.DEBUG:
        print(f"[DEV] SMS для {phone}: код = {code}")
        return

    from twilio.rest import Client
    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    client.messages.create(
        body=f"Ваш код: {code}",
        from_=settings.TWILIO_PHONE_NUMBER,
        to=phone,
    )


async def send_code(request: SendCodeRequest, db: AsyncSession):
    phone = _normalize_phone(request.phone)
    code = _generate_otp()

    redis = await get_redis()
    await redis.setex(f"otp:{phone}", OTP_TTL_SECONDS, code)

    await _send_sms(phone, code)

    # Проверяем, существует ли уже пользователь с таким номером
    result = await db.execute(select(User).where(User.phone == phone))
    existing_user = result.scalar_one_or_none()

    response_data = {
        "detail": "Код отправлен",
        "phone": phone,
        "is_new": existing_user is None,
        "display_name": existing_user.display_name if existing_user else None,
    }
    if settings.DEBUG:
        response_data["code"] = code
    return response_data


async def verify_code(request: VerifyCodeRequest, db: AsyncSession) -> TokenResponse:
    phone = _normalize_phone(request.phone)
    redis = await get_redis()

    # GETDEL: забираем и удаляем код одним шагом, чтобы нельзя было
    # переиспользовать его повторно (race condition отсечена на сервере Redis)
    stored_code = await redis.getdel(f"otp:{phone}")
    if not stored_code or stored_code != request.code:
        # Лимит попыток ввода кода: 5 на 10 минут
        attempts = await redis.incr(f"otp_attempts:{phone}")
        if attempts == 1:
            await redis.expire(f"otp_attempts:{phone}", 600)
        if attempts > 5:
            raise HTTPException(
                status_code=429, detail="Слишком много попыток. Запросите новый код."
            )
        raise HTTPException(status_code=400, detail="Неверный или устаревший код")

    await redis.delete(f"otp_attempts:{phone}")

    # Найти или создать пользователя
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()

    if not user:
        user = User(phone=phone, display_name=request.display_name or phone)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    # Сохранить refresh токен в Redis
    await redis.setex(
        f"refresh:{user.id}",
        settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        refresh_token,
    )

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


async def refresh_tokens(refresh_token: str) -> TokenResponse:
    payload = verify_token(refresh_token, token_type="refresh")
    if not payload:
        raise HTTPException(status_code=401, detail="Токен недействителен")

    user_id = payload.get("sub")
    redis = await get_redis()
    stored = await redis.get(f"refresh:{user_id}")

    if stored != refresh_token:
        raise HTTPException(status_code=401, detail="Токен отозван")

    new_access = create_access_token({"sub": user_id})
    new_refresh = create_refresh_token({"sub": user_id})

    await redis.setex(
        f"refresh:{user_id}",
        settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        new_refresh,
    )

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)
