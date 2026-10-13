from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


from sqlalchemy import text


async def create_tables():
    """Создать все таблицы (используется при разработке)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        columns = [
            "ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES chat_roles(id) ON DELETE SET NULL",
            "ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS custom_title VARCHAR(64)",
            "ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS can_manage_roles BOOLEAN DEFAULT FALSE NOT NULL",
            "ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS can_manage_members BOOLEAN DEFAULT FALSE NOT NULL",
            "ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS can_delete_messages BOOLEAN DEFAULT FALSE NOT NULL",
            "ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS can_pin_messages BOOLEAN DEFAULT FALSE NOT NULL",
            "ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS can_change_info BOOLEAN DEFAULT FALSE NOT NULL",
            "ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS can_post_messages BOOLEAN DEFAULT TRUE NOT NULL",
        ]
        for col_query in columns:
            try:
                await conn.execute(text(col_query))
            except Exception:
                pass

