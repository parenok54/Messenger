from pydantic import BaseModel, Field
from typing import Optional


class SendCodeRequest(BaseModel):
    identifier: Optional[str] = None  # Номер телефона или Email
    phone: Optional[str] = None       # Для обратной совместимости
    email: Optional[str] = None
    purpose: Optional[str] = "login"  # "login" | "register"
    reg_phone: Optional[str] = None   # Обязательный телефон при регистрации по email
    display_name: Optional[str] = None
    link_email: Optional[str] = None  # Почта для привязки к аккаунту без email


class VerifyCodeRequest(BaseModel):
    identifier: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    code: str
    display_name: Optional[str] = None  # При регистрации
    username: Optional[str] = None      # При регистрации
    reg_phone: Optional[str] = None     # Обязательный телефон при регистрации
    link_email: Optional[str] = None    # Почта для привязки к аккаунту при верификации


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class LoginPasswordRequest(BaseModel):
    login: str = Field(..., description="Телефон, имя пользователя или email")
    password: str = Field(..., min_length=4, description="Пароль пользователя")


class RegisterPasswordRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    display_name: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=4, max_length=128)
    phone: Optional[str] = None
    email: Optional[str] = None


class DemoLoginRequest(BaseModel):
    user_type: str = Field(..., description="Идентификатор демо-пользователя: alex, anna, guest")
