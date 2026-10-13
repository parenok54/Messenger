import os
import uuid

import aiofiles

from app.core.config import settings

# Расширение определяется по MIME-типу, а не по имени файла,
# чтобы загрузчик не мог прислать например "evil.php".
import re

_EXTENSION_BY_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/bmp": "bmp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-msvideo": "avi",
    "video/x-matroska": "mkv",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "audio/wav": "wav",
    "audio/flac": "flac",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/csv": "csv",
    "application/json": "json",
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
    "application/x-rar-compressed": "rar",
    "application/vnd.rar": "rar",
    "application/x-7z-compressed": "7z",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
}


def _extension_for(content_type: str | None, filename: str | None = None) -> str:
    if content_type:
        clean_ct = content_type.split(";")[0].strip().lower()
        if clean_ct in _EXTENSION_BY_TYPE:
            return _EXTENSION_BY_TYPE[clean_ct]

    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower().strip()
        blocked_exts = {e.strip().lower() for e in settings.BLOCKED_EXTENSIONS.split(",") if e.strip()}
        if ext and ext not in blocked_exts and re.match(r"^[a-z0-9]{1,10}$", ext):
            return ext

    return "bin"


async def upload_file(file_bytes: bytes, filename: str, content_type: str) -> str:
    """Сохранить файл локально и вернуть публичный URL."""
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = _extension_for(content_type, filename)
    key = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, key)

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(file_bytes)

    return f"{settings.SERVER_HOST.rstrip('/')}/uploads/{key}"


async def delete_file(url: str):
    """Удалить локальный файл по URL."""
    prefix = "/uploads/"
    if prefix not in url:
        return

    filename = url.split(prefix)[-1]
    # Защита от path traversal: берём только basename
    filename = os.path.basename(filename)
    if not filename:
        return

    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    # Убеждаемся, что путь остаётся внутри UPLOAD_DIR
    upload_root = os.path.abspath(settings.UPLOAD_DIR)
    target = os.path.abspath(file_path)
    if os.path.commonpath([upload_root, target]) != upload_root:
        return

    if os.path.exists(target):
        os.remove(target)
