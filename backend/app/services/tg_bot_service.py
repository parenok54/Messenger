import re
import asyncio
import httpx
from typing import Optional

from app.core.config import settings
from app.core.redis import get_redis


def _get_api_url(method: str) -> str:
    return f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/{method}"


async def send_telegram_otp(phone: str, code: str) -> bool:
    """Отправить проверочный код пользователю в Telegram, если он привязал номер к боту."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return False

    redis = await get_redis()
    clean_digits = re.sub(r"[^\d]", "", phone)
    
    # Ищем сохранённый chat_id пользователя
    chat_id = await redis.get(f"tg_phone:{clean_digits}")
    if not chat_id:
        chat_id = await redis.get(f"tg_phone:+{clean_digits}")

    if not chat_id:
        return False

    text = (
        f"🔐 <b>Код авторизации:</b> <code>{code}</code>\n\n"
        f"Никому не сообщайте этот код, даже если его запрашивают от имени Messenger!\n\n"
        f"Этот код используется для входа в ваш аккаунт. Срок действия: 5 минут.\n\n"
        f"<i>Если вы не запрашивали вход, просто проигнорируйте это сообщение.</i>"
    )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                _get_api_url("sendMessage"),
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                },
            )
            data = resp.json()
            if data.get("ok"):
                print(f"[AUTH TG] ✅ Код успешно отправлен в Telegram на chat_id={chat_id} (тел: {phone})", flush=True)
                return True
            else:
                print(f"[AUTH TG ERROR] Ошибка sendMessage: {data}", flush=True)
                return False
    except Exception as e:
        print(f"[AUTH TG ERROR] Ошибка отправки в Telegram: {e}", flush=True)
        return False


async def run_tg_bot_poller():
    """Фоновый воркер Telegram-бота для получения контактов от пользователей."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return

    print(f"[TG BOT] 🤖 Запуск фонового поллинга Telegram-бота...", flush=True)
    offset = 0

    while True:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    _get_api_url("getUpdates"),
                    params={"offset": offset, "timeout": 20},
                )
                if resp.status_code != 200:
                    await asyncio.sleep(5)
                    continue

                data = resp.json()
                if not data.get("ok"):
                    await asyncio.sleep(5)
                    continue

                updates = data.get("result", [])
                for update in updates:
                    offset = max(offset, update["update_id"] + 1)
                    message = update.get("message")
                    if not message:
                        continue

                    chat_id = message["chat"]["id"]

                    # 1. Пользователь поделился контактом (нажал кнопку)
                    if "contact" in message:
                        raw_phone = message["contact"]["phone_number"]
                        clean_digits = re.sub(r"[^\d]", "", raw_phone)
                        e164_phone = "+" + clean_digits if not raw_phone.startswith("+") else raw_phone

                        redis = await get_redis()
                        # Сохраняем привязку номера телефона к chat_id
                        await redis.set(f"tg_phone:{clean_digits}", str(chat_id))
                        await redis.set(f"tg_phone:{e164_phone}", str(chat_id))
                        await redis.set(f"tg_chat:{chat_id}", e164_phone)

                        # Проверяем, есть ли уже активный запрос кода для этого номера
                        active_code = await redis.get(f"otp:{e164_phone}")
                        if not active_code:
                            active_code = await redis.get(f"otp:{clean_digits}")

                        reply_text = (
                            f"✅ Номер <b>{e164_phone}</b> успешно подтверждён!\n\n"
                        )
                        if active_code:
                            reply_text += (
                                f"🔐 <b>Код авторизации:</b> <code>{active_code}</code>\n\n"
                                f"Никому не сообщайте этот код!\n"
                                f"Введите его на экране входа в приложении."
                            )
                        else:
                            reply_text += (
                                "Теперь все проверочные коды для входа в Messenger "
                                "будут мгновенно приходить прямо в этот чат!"
                            )

                        await client.post(
                            _get_api_url("sendMessage"),
                            json={
                                "chat_id": chat_id,
                                "text": reply_text,
                                "parse_mode": "HTML",
                                "reply_markup": {"remove_keyboard": True},
                            },
                        )

                    # 2. Пользователь отправил команду /start
                    elif message.get("text", "").startswith("/start"):
                        welcome_text = (
                            "👋 <b>Messenger Service Notifications</b>\n\n"
                            "Официальный сервис системных уведомлений и кодов авторизации для входа в <b>Messenger</b>.\n\n"
                            "Нажмите кнопку ниже, чтобы привязать номер телефона в один клик:"
                        )
                        reply_markup = {
                            "keyboard": [
                                [
                                    {
                                        "text": "📱 Подтвердить номер телефона",
                                        "request_contact": True,
                                    }
                                ]
                            ],
                            "resize_keyboard": True,
                            "one_time_keyboard": True,
                        }
                        await client.post(
                            _get_api_url("sendMessage"),
                            json={
                                "chat_id": chat_id,
                                "text": welcome_text,
                                "parse_mode": "HTML",
                                "reply_markup": reply_markup,
                            },
                        )

        except asyncio.CancelledError:
            print("[TG BOT] Остановка поллинга Telegram-бота...")
            break
        except Exception as e:
            # Не роняем воркер при сетевых сбоях
            await asyncio.sleep(5)
