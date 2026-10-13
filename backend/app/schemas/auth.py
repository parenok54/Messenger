from pydantic import BaseModel
from typing import Optional


class SendCodeRequest(BaseModel):
    phone: str  # Формат: +79991234567


class VerifyCodeRequest(BaseModel):
    phone: str
    code: str
    display_name: Optional[str] = None  # При первой регистрации


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str
