from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

# .env лежит в backend/, поэтому путь привязываем к расположению этого файла,
# а не к текущей рабочей директории — иначе настройки не находятся,
# если приложение запущено из другого каталога.
_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    # Приложение
    APP_NAME: str = "Messenger"
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 дней, как в Telegram
    REFRESH_TOKEN_EXPIRE_DAYS: int = 90
    DEBUG: bool = True

    # База данных
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/messenger"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Twilio (SMS-коды подтверждения)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""

    # Загрузки файлов
    UPLOAD_DIR: str = "uploads"
    SERVER_HOST: str = "http://localhost:8000"
    MAX_AVATAR_SIZE: int = 5 * 1024 * 1024      # 5 МБ
    MAX_MESSAGE_FILE_SIZE: int = 25 * 1024 * 1024  # 25 МБ
    ALLOWED_MESSAGE_CONTENT_TYPES: str = (
        "image/,video/,audio/,application/pdf,text/plain,"
        "application/zip,application/msword,"
        "application/vnd.openxmlformats-officedocument."
    )
    # Типы, которые формально матчатся белым списком, но опасны:
    # SVG может содержать <script> → XSS при открытии в браузере.
    BLOCKED_MESSAGE_CONTENT_TYPES: str = "image/svg+xml,image/svg"

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8081"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    @property
    def allowed_message_content_prefixes(self) -> List[str]:
        return [p.strip() for p in self.ALLOWED_MESSAGE_CONTENT_TYPES.split(",") if p.strip()]

    @property
    def blocked_message_content_types(self) -> List[str]:
        return [p.strip().lower() for p in self.BLOCKED_MESSAGE_CONTENT_TYPES.split(",") if p.strip()]

    def is_allowed_message_content_type(self, content_type: str | None) -> bool:
        """
        Проверить MIME-тип вложения.
        1. Отбрасываются параметры вида "; charset=utf-8".
        2. Сначала проверяется блок-лист (svg и т.п.) — он приоритетнее белого списка.
        3. Затем сопоставление с разрешёнными префиксами.
        """
        if not content_type:
            return False

        normalized = content_type.split(";", 1)[0].strip().lower()
        if normalized in self.blocked_message_content_types:
            return False

        return any(
            normalized.startswith(prefix.strip().lower())
            for prefix in self.allowed_message_content_prefixes
        )

    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")


settings = Settings()

# Небезопасные значения SECRET_KEY, при которых подпись JWT скомпрометирована.
UNSAFE_SECRET_KEYS = {"change-me", "your-super-secret-key-change-me-in-production", ""}


def ensure_secret_key_is_safe(secret_key: str, debug: bool) -> None:
    """
    В продакшене (DEBUG=False) SECRET_KEY не должен быть значением по умолчанию —
    иначе любой сможет подписать свой JWT и войти под чужим id.
    """
    if secret_key in UNSAFE_SECRET_KEYS and not debug:
        raise RuntimeError(
            "SECRET_KEY не задан или имеет небезопасное значение по умолчанию. "
            "Сгенерируй надёжный ключ: python -c \"import secrets; print(secrets.token_urlsafe(48))\" "
            "и укажи его в переменной окружения SECRET_KEY."
        )


ensure_secret_key_is_safe(settings.SECRET_KEY, settings.DEBUG)
