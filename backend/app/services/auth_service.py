import secrets
import string
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
import phonenumbers

from app.models.user import User
from app.schemas.auth import (
    SendCodeRequest,
    VerifyCodeRequest,
    TokenResponse,
    LoginPasswordRequest,
    RegisterPasswordRequest,
    DemoLoginRequest,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_token,
    hash_password,
    verify_password,
)
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


async def _issue_tokens_for_user(user_id: str) -> TokenResponse:
    access_token = create_access_token({"sub": str(user_id)})
    refresh_token = create_refresh_token({"sub": str(user_id)})

    redis = await get_redis()
    await redis.setex(
        f"refresh:{user_id}",
        settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        refresh_token,
    )
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


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

    # GETDEL: забираем и удаляем код одним шагом
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

    return await _issue_tokens_for_user(str(user.id))


async def login_with_password(request: LoginPasswordRequest, db: AsyncSession) -> TokenResponse:
    login_val = request.login.strip()
    
    # Пытаемся нормализовать как номер, если начинается с '+' или цифр
    possible_phone = None
    try:
        parsed = phonenumbers.parse(login_val, None)
        if phonenumbers.is_valid_number(parsed):
            possible_phone = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        pass

    query = select(User).where(
        or_(
            User.username == login_val,
            User.email == login_val.lower(),
            User.phone == login_val,
            *([User.phone == possible_phone] if possible_phone else [])
        )
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(status_code=400, detail="Неверный логин или пароль")

    if not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный логин или пароль")

    return await _issue_tokens_for_user(str(user.id))


async def register_with_password(request: RegisterPasswordRequest, db: AsyncSession) -> TokenResponse:
    username = request.username.strip()
    
    # Проверка уникальности username
    res = await db.execute(select(User).where(User.username == username))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Это имя пользователя уже занято")

    email = request.email.strip().lower() if request.email else None
    if email:
        res = await db.execute(select(User).where(User.email == email))
        if res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Этот email уже зарегистрирован")

    phone = None
    if request.phone:
        phone = _normalize_phone(request.phone)
        res = await db.execute(select(User).where(User.phone == phone))
        if res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Этот номер телефона уже зарегистрирован")

    user = User(
        username=username,
        display_name=request.display_name.strip(),
        password_hash=hash_password(request.password),
        email=email,
        phone=phone,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return await _issue_tokens_for_user(str(user.id))


DEMO_USERS = {
    "alex": {
        "phone": "+79990000001",
        "username": "alex_lead",
        "display_name": "Алексей Смирнов",
        "bio": "Lead Fullstack Dev 🚀",
    },
    "anna": {
        "phone": "+79990000002",
        "username": "anna_design",
        "display_name": "Анна Ковалёва",
        "bio": "Product & UI/UX Designer ✨",
    },
    "guest": {
        "phone": "+79990000003",
        "username": "guest_tester",
        "display_name": "Тестовый Пользователь",
        "bio": "Новый участник Messenger",
    },
}


async def demo_login(user_type: str, db: AsyncSession) -> TokenResponse:
    demo_info = DEMO_USERS.get(user_type.lower())
    if not demo_info:
        raise HTTPException(status_code=400, detail=f"Неизвестный демо-пользователь: {user_type}")

    # Поиск по username или phone
    result = await db.execute(
        select(User).where(
            or_(
                User.username == demo_info["username"],
                User.phone == demo_info["phone"],
            )
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            phone=demo_info["phone"],
            username=demo_info["username"],
            display_name=demo_info["display_name"],
            bio=demo_info["bio"],
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Обновим имя и био, если были пустые
        if not user.display_name:
            user.display_name = demo_info["display_name"]
            await db.commit()

    return await _issue_tokens_for_user(str(user.id))


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


async def logout_user(user_id: str):
    redis = await get_redis()
    await redis.delete(f"refresh:{user_id}")
