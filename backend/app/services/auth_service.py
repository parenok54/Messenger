import re
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
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_phone(phone: str) -> str:
    try:
        parsed = phonenumbers.parse(phone, None)
        if not phonenumbers.is_valid_number(parsed):
            raise ValueError
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        raise HTTPException(status_code=400, detail="Неверный формат номера телефона")


def _resolve_identifier(raw: str) -> tuple[str, str]:
    """Определяет, является ли входной идентификатор email или номером телефона.
    Возвращает кортеж: (нормализованное_значение, 'email' | 'phone')
    """
    if not raw:
        raise HTTPException(status_code=400, detail="Укажите номер телефона или адрес электронной почты")
    val = raw.strip()
    if "@" in val:
        if not EMAIL_REGEX.match(val):
            raise HTTPException(status_code=400, detail="Неверный формат адреса электронной почты")
        return val.lower(), "email"
    else:
        return _normalize_phone(val), "phone"


def _generate_otp() -> str:
    # secrets вместо random: код подвергается перебору, нужен CSPRNG
    return "".join(secrets.choice(string.digits) for _ in range(6))


import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio


import httpx


async def _send_sms(phone: str, code: str):
    """Отправить проверочный код: Telegram-бот -> SMS.RU -> Twilio."""
    # 1. Приоритет: Бесплатная доставка через официального Telegram-бота
    if settings.TELEGRAM_BOT_TOKEN:
        from app.services.tg_bot_service import send_telegram_otp
        sent_tg = await send_telegram_otp(phone, code)
        if sent_tg:
            return

    # 2. SMS.RU
    if settings.SMSRU_API_KEY:
        try:
            clean_phone = re.sub(r"[^\d]", "", phone)
            msg_text = f"Ваш проверочный код в Messenger: {code}"
            url = "https://sms.ru/sms/send"
            params = {
                "api_id": settings.SMSRU_API_KEY,
                "to": clean_phone,
                "msg": msg_text,
                "json": 1,
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, params=params)
                data = res.json()
                if data.get("status") == "OK" and data.get("status_code") == 100:
                    print(f"[AUTH SMS] ✅ Реальное SMS через SMS.RU успешно отправлено на {phone}!")
                    return
                else:
                    print(f"[AUTH SMS ERROR] ❌ SMS.RU ошибка ответа: {data}")
        except Exception as e:
            print(f"[AUTH SMS ERROR] ❌ Ошибка запроса к SMS.RU: {e}")

    # 3. Twilio (резерв)
    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
        try:
            from twilio.rest import Client
            client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            client.messages.create(
                body=f"Ваш проверочный код в Messenger: {code}",
                from_=settings.TWILIO_PHONE_NUMBER,
                to=phone,
            )
            print(f"[AUTH SMS] ✅ Реальное SMS через Twilio успешно отправлено на {phone}!")
            return
        except Exception as e:
            print(f"[AUTH SMS ERROR] ❌ Ошибка отправки SMS через Twilio: {e}")

    print(f"[AUTH SMS] ℹ️ Проверочный код: {code}. Для получения в Telegram запустите бота, либо настройте SMSRU_API_KEY в .env")


def _send_email_smtp_sync(to_email: str, code: str):
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"[AUTH EMAIL] ⚠️ SMTP не настроен в .env. Для реальной отправки на почту укажите SMTP_USER и SMTP_PASSWORD. Проверочный код: {code}")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{code} — Ваш проверочный код Messenger"
    from_addr = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    msg["From"] = f"Messenger <{from_addr}>"
    msg["To"] = to_email

    text_content = f"Ваш проверочный код для входа в Messenger: {code}\nКод действителен 5 минут."
    html_content = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0e1621; color: #ffffff; padding: 40px 20px; border-radius: 16px; max-width: 480px; margin: 0 auto; text-align: center;">
      <h2 style="color: #2AABEE; margin-bottom: 6px; font-size: 26px;">Messenger</h2>
      <p style="color: #9eabb8; font-size: 14px; margin-top: 0;">Код подтверждения для авторизации</p>
      <div style="background-color: #17212b; border: 1px solid rgba(42, 171, 238, 0.4); border-radius: 12px; padding: 22px; margin: 24px 0;">
        <span style="font-size: 38px; font-weight: bold; letter-spacing: 10px; color: #2AABEE; font-family: monospace;">{code}</span>
      </div>
      <p style="color: #6c7883; font-size: 12px; margin-bottom: 0;">Никому не передавайте этот код. Срок действия: 5 минут.</p>
    </div>
    """
    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=12) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        print(f"[AUTH EMAIL] ✅ Реальное письмо с кодом успешно доставлено на {to_email}!")
    except Exception as e:
        print(f"[AUTH EMAIL ERROR] ❌ Ошибка отправки письма через SMTP ({settings.SMTP_HOST}): {e}")


async def _send_email(email: str, code: str):
    """Отправить код на Email через SMTP."""
    await asyncio.to_thread(_send_email_smtp_sync, email, code)


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


def _mask_email(email: str) -> str:
    if "@" not in email:
        return email
    user_part, domain = email.split("@", 1)
    if len(user_part) <= 2:
        masked_user = user_part[0] + "*"
    else:
        masked_user = user_part[0] + "***" + user_part[-1]
    return f"{masked_user}@{domain}"


async def send_code(request: SendCodeRequest, db: AsyncSession):
    purpose = request.purpose or "login"
    raw_val = request.identifier or request.email or request.phone
    identifier, channel = _resolve_identifier(raw_val)

    if purpose == "register":
        # ─── РЕГИСТРАЦИЯ: ТОЛЬКО ПОЧТА С ОБЯЗАТЕЛЬНЫМ ТЕЛЕФОНОМ ───
        if channel != "email":
            raise HTTPException(
                status_code=400,
                detail="Регистрация выполняется через Email с обязательным указанием номера телефона.",
            )

        if not request.reg_phone:
            raise HTTPException(
                status_code=400,
                detail="Укажите номер телефона. Номер телефона обязателен для регистрации.",
            )

        clean_reg_phone, reg_ch = _resolve_identifier(request.reg_phone)
        if reg_ch != "phone":
            raise HTTPException(
                status_code=400,
                detail="Укажите корректный номер телефона (например: +79991234567).",
            )

        # Проверяем уникальность email
        email_res = await db.execute(select(User).where(User.email == identifier))
        if email_res.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Аккаунт с такой почтой уже существует. Пожалуйста, выполните вход.",
            )

        # Проверяем уникальность телефона
        phone_res = await db.execute(select(User).where(User.phone == clean_reg_phone))
        if phone_res.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail="Аккаунт с таким номером телефона уже существует. Пожалуйста, выполните вход.",
            )

        code = _generate_otp()
        redis = await get_redis()
        await redis.setex(f"otp:{identifier}", OTP_TTL_SECONDS, code)

        # Сохраняем временные данные для создания аккаунта при верификации
        import json
        reg_payload = {
            "phone": clean_reg_phone,
            "display_name": request.display_name or identifier.split("@")[0],
        }
        await redis.setex(f"reg_data:{identifier}", OTP_TTL_SECONDS + 300, json.dumps(reg_payload))

        # Отправляем реальный код на почту
        await _send_email(identifier, code)

        return {
            "detail": f"Код подтверждения отправлен на вашу почту {identifier}",
            "identifier": identifier,
            "channel": "email",
            "is_new": True,
            "display_name": request.display_name,
        }

    else:
        # ─── ВХОД: ПО ТЕЛЕФОНУ ИЛИ ПОЧТЕ, НО КОД ВСЕГДА НА ПОЧТУ ───
        if channel == "email":
            result = await db.execute(select(User).where(User.email == identifier))
            user = result.scalar_one_or_none()
            if not user:
                raise HTTPException(
                    status_code=404,
                    detail="Пользователь с такой почтой не найден. Пожалуйста, зарегистрируйтесь.",
                )
            target_email = user.email
            lookup_key = identifier
        else:
            # Вход по номеру телефона: находим пользователя и отправляем код на его привязанную почту
            result = await db.execute(select(User).where(User.phone == identifier))
            user = result.scalar_one_or_none()
            if not user:
                raise HTTPException(
                    status_code=404,
                    detail="Пользователь с таким номером телефона не найден. Пожалуйста, зарегистрируйтесь.",
                )
            if not user.email:
                # Пользователь регистрировался ранее по номеру без почты!
                provided_email = request.link_email or request.email
                if not provided_email:
                    # Сообщаем фронтенду и пользователю, что нужно добавить почту
                    return {
                        "status": "needs_email",
                        "needs_email": True,
                        "identifier": identifier,
                        "detail": "Вы ранее регистрировались по номеру телефона. Сейчас подтверждение работает через почту — пожалуйста, укажите адрес вашей электронной почты для получения кода и привязки к аккаунту.",
                        "display_name": user.display_name,
                    }

                clean_link_email, link_ch = _resolve_identifier(provided_email)
                if link_ch != "email":
                    raise HTTPException(
                        status_code=400,
                        detail="Укажите корректный адрес электронной почты (например: user@gmail.com).",
                    )
                # Проверяем, не занята ли эта почта другим аккаунтом
                dup_email_res = await db.execute(
                    select(User).where(User.email == clean_link_email, User.id != user.id)
                )
                if dup_email_res.scalar_one_or_none():
                    raise HTTPException(
                        status_code=400,
                        detail="Этот адрес электронной почты уже используется другим аккаунтом. Пожалуйста, укажите другую почту.",
                    )

                target_email = clean_link_email
                lookup_key = identifier
                is_linking = True
            else:
                target_email = user.email
                lookup_key = identifier
                is_linking = False

        code = _generate_otp()
        redis = await get_redis()
        # Сохраняем код для ключа, по которому входили (телефон или почта)
        await redis.setex(f"otp:{lookup_key}", OTP_TTL_SECONDS, code)
        if target_email != lookup_key:
            await redis.setex(f"otp:{target_email}", OTP_TTL_SECONDS, code)

        if not user.email and is_linking:
            # Запоминаем почту для привязки к аккаунту после верификации
            await redis.setex(f"pending_email:{lookup_key}", OTP_TTL_SECONDS + 600, target_email)

        # Всегда отправляем код на почту пользователя
        await _send_email(target_email, code)

        masked = _mask_email(target_email)
        return {
            "status": "code_sent",
            "detail": f"Код подтверждения отправлен на почту {masked}. После ввода кода почта будет привязана к аккаунту." if (not user.email and is_linking) else f"Код подтверждения отправлен на привязанную почту {masked}",
            "identifier": lookup_key,
            "channel": "email",
            "target_email": masked,
            "full_email": target_email if (not user.email and is_linking) else None,
            "is_new": False,
            "display_name": user.display_name,
            "needs_email": False,
        }


async def verify_code(request: VerifyCodeRequest, db: AsyncSession) -> TokenResponse:
    raw_val = request.identifier or request.email or request.phone
    identifier, channel = _resolve_identifier(raw_val)

    redis = await get_redis()

    # GETDEL: забираем и удаляем код одним шагом
    stored_code = await redis.getdel(f"otp:{identifier}")
    if not stored_code or stored_code != request.code:
        attempts = await redis.incr(f"otp_attempts:{identifier}")
        if attempts == 1:
            await redis.expire(f"otp_attempts:{identifier}", 600)
        if attempts > 5:
            raise HTTPException(
                status_code=429, detail="Слишком много попыток. Запросите новый код."
            )
        raise HTTPException(status_code=400, detail="Неверный или устаревший проверочный код")

    await redis.delete(f"otp_attempts:{identifier}")

    # Найти пользователя
    if channel == "email":
        result = await db.execute(select(User).where(User.email == identifier))
    else:
        result = await db.execute(select(User).where(User.phone == identifier))
    user = result.scalar_one_or_none()

    if user:
        # Проверяем, привязывается ли почта для существующего пользователя
        pending_email = await redis.getdel(f"pending_email:{identifier}")
        link_email = request.link_email or pending_email
        if link_email and not user.email:
            clean_link, l_ch = _resolve_identifier(link_email)
            if l_ch == "email":
                dup_check = await db.execute(
                    select(User).where(User.email == clean_link, User.id != user.id)
                )
                if not dup_check.scalar_one_or_none():
                    user.email = clean_link
                    await db.commit()
                    await db.refresh(user)

    if not user:
        # Регистрация нового пользователя
        import json
        reg_data_raw = await redis.getdel(f"reg_data:{identifier}")
        reg_data = json.loads(reg_data_raw) if reg_data_raw else {}

        phone_to_save = request.reg_phone or reg_data.get("phone") or (identifier if channel == "phone" else None)
        email_to_save = identifier if channel == "email" else None
        display_name_to_save = request.display_name or reg_data.get("display_name") or (email_to_save.split("@")[0] if email_to_save else "User")

        # Проверяем уникальность username при создании
        chosen_username = None
        if request.username:
            u_clean = request.username.strip().lstrip("@")
            u_res = await db.execute(select(User).where(User.username == u_clean))
            if u_res.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Это имя пользователя уже занято")
            chosen_username = u_clean

        user = User(
            phone=phone_to_save,
            email=email_to_save,
            username=chosen_username,
            display_name=display_name_to_save,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return await _issue_tokens_for_user(str(user.id))


async def login_with_password(request: LoginPasswordRequest, db: AsyncSession) -> TokenResponse:
    login_val = request.login.strip()
    
    possible_phone = None
    try:
        parsed = phonenumbers.parse(login_val, None)
        if phonenumbers.is_valid_number(parsed):
            possible_phone = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        pass

    query = select(User).where(
        or_(
            User.username == login_val.lstrip("@"),
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
    username = request.username.strip().lstrip("@")
    
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
