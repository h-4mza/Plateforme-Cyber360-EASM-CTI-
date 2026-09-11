from pydantic import BaseModel, EmailStr
from datetime import datetime
import uuid
from app.models.user import UserRole
from app.models.invitation import InvitationStatus

class InvitationCreate(BaseModel):
    email: EmailStr
    role: UserRole = UserRole.analyst

class InvitationResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    status: InvitationStatus
    expires_at: datetime
    created_at: datetime
    invited_by_id: uuid.UUID

    class Config:
        from_attributes = True

class InvitationAccept(BaseModel):
    password: str
    full_name: str | None = None
