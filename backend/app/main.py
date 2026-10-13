import os
from fastapi import FastAPI, WebSocket, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import create_tables, AsyncSessionLocal
from app.models.user import User
from sqlalchemy import update
from app.core.redis import init_redis, close_redis
from app.api import auth, users, chats, messages
from app.ws.gateway import websocket_endpoint


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Запуск
    await init_redis()
    await create_tables()
    # Сбросить зависшие онлайн-статусы после возможного рестарта сервера
    async with AsyncSessionLocal() as db:
        await db.execute(update(User).values(is_online=False))
        await db.commit()
    yield
    # Завершение
    await close_redis()


app = FastAPI(
    title=settings.APP_NAME,
    description="Мессенджер API — похожий на Telegram",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST роутеры
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(chats.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")

# Static files (uploads)
# Файлы раздаются без авторизации, но имена генерируются на сервере (UUID),
# поэтому угадать ссылку невозможно. В продакшене этот путь лучше закрыть
# nginx/CDN с ограничением по Referer или подписанными ссылками.
UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# WebSocket
@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket, token: str = Query(...)):
    await websocket_endpoint(websocket, token)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
