from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

class OrganizationBase(BaseModel):
    name: str
    sector: Optional[str] = None
    size: Optional[str] = None
    country: Optional[str] = None
    primary_contact_email: Optional[str] = None

class OrganizationUpdate(OrganizationBase):
    name: Optional[str] = None

class OrganizationResponse(OrganizationBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
