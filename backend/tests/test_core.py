"""Тесты ключевой логики бэкенда, которые не требуют БД и Redis.

Запуск:
    python -m pytest backend/tests -v
"""
import sys
import uuid
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from app.core.config import settings, ensure_secret_key_is_safe, UNSAFE_SECRET_KEYS
from app.core.storage import _extension_for
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_token,
    hash_password,
    verify_password,
)
from app.ws.gateway import _parse_uuid


# ─── Безопасный SECRET_KEY ───────────────────────────────────────────────────

@pytest.mark.parametrize("unsafe_key", sorted(UNSAFE_SECRET_KEYS))
def test_default_secret_key_rejected_in_production(unsafe_key):
    """При DEBUG=False небезопасный SECRET_KEY должен приводить к ошибке запуска."""
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        ensure_secret_key_is_safe(unsafe_key, debug=False)


def test_default_secret_key_allowed_in_debug():
    """В режиме разработки (DEBUG=True) дефолтный ключ допустим для удобства."""
    ensure_secret_key_is_safe("change-me", debug=True)  # не должно бросать исключение


def test_strong_secret_key_allowed_in_production():
    """Сильный SECRET_KEY проходит проверку и в продакшене."""
    ensure_secret_key_is_safe("a" * 64, debug=False)  # не должно бросать исключение


# ─── Whitelist типов файлов ──────────────────────────────────────────────────

@pytest.mark.parametrize(
    "content_type,expected",
    [
        ("image/jpeg", True),
        ("image/png", True),
        ("video/mp4", True),
        ("audio/ogg", True),
        ("application/pdf", True),
        ("text/plain", True),
        ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", True),
        # Параметры вида "; charset=utf-8" должны отбрасываться
        ("image/jpeg; charset=binary", True),
        ("IMAGE/PNG", True),
        ("  image/png  ", True),
        # Небезопасные типы должны отклоняться
        ("text/html", False),
        ("image/svg+xml", False),
        ("image/svg+xml; charset=utf-8", False),
        ("application/x-httpd-php", False),
        ("application/octet-stream", False),
        ("", False),
        (None, False),
    ],
)
def test_message_content_type_whitelist(content_type, expected):
    assert settings.is_allowed_message_content_type(content_type) is expected


@pytest.mark.parametrize(
    "content_type,extension",
    [
        ("image/jpeg", "jpg"),
        ("video/mp4", "mp4"),
        ("application/pdf", "pdf"),
        # Неизвестный тип -> безопасное .bin, а не расширение из имени файла
        ("image/svg+xml", "bin"),
        ("application/x-httpd-php", "bin"),
    ],
)
def test_extension_is_derived_from_content_type(content_type, extension):
    """Расширение не берётся из имени файла, поэтому .php невозможен."""
    assert _extension_for(content_type) == extension


# ─── JWT ─────────────────────────────────────────────────────────────────────

def test_access_token_roundtrip():
    token = create_access_token({"sub": str(uuid.uuid4())})
    payload = verify_token(token)
    assert payload is not None
    assert payload["type"] == "access"
    assert payload.get("sub")


def test_refresh_token_is_not_accepted_as_access():
    """Refresh-токен нельзя использовать как access-токен."""
    token = create_refresh_token({"sub": str(uuid.uuid4())})
    assert verify_token(token, "access") is None
    assert verify_token(token, "refresh") is not None


def test_tampered_token_rejected():
    token = create_access_token({"sub": str(uuid.uuid4())})
    assert verify_token(token[:-4] + "abcd") is None
    assert verify_token("garbage") is None


# ─── Безопасный разбор UUID в WS ─────────────────────────────────────────────

@pytest.mark.parametrize(
    "value",
    [
        "not-a-uuid",
        "12345",
        "",
        None,
        "../../etc/passwd",
        {"id": 1},
    ],
)
def test_parse_uuid_returns_none_instead_of_raising(value):
    """Мусор в chat_id/message_id не должен ронять WS-соединение."""
    assert _parse_uuid(value) is None


def test_parse_uuid_valid():
    value = str(uuid.uuid4())
    assert _parse_uuid(value) == uuid.UUID(value)


# ─── Хеширование паролей ───────────────────────────────────────────────────

def test_password_hash_and_verify():
    raw_pwd = "mySuperSecretPassword123"
    hashed = hash_password(raw_pwd)
    assert hashed != raw_pwd
    assert verify_password(raw_pwd, hashed) is True
    assert verify_password("wrongPassword", hashed) is False
    assert verify_password("", hashed) is False
