from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid
from app.models.user import UserRole

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    organization_name: str
    full_name: Optional[str] = None
    sector: Optional[str] = None
    size: Optional[str] = None  
    country: Optional[str] = None
    primary_contact_email: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str
