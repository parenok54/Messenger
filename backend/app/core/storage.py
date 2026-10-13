import os
import uuid

import aiofiles

from app.core.config import settings

# Расширение определяется по MIME-типу, а не по имени файла,
# чтобы загрузчик не мог прислать например "evil.php".
_EXTENSION_BY_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/heic": "heic",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/webm": "weba",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "application/zip": "zip",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
}


def _extension_for(content_type: str | None) -> str:
    if content_type and content_type in _EXTENSION_BY_TYPE:
        return _EXTENSION_BY_TYPE[content_type]
    return "bin"


async def upload_file(file_bytes: bytes, filename: str, content_type: str) -> str:
    """Сохранить файл локально и вернуть публичный URL."""
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    key = f"{uuid.uuid4()}.{_extension_for(content_type)}"
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
