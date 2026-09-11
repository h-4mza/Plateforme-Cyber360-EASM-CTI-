from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
from app.models.domain import DomainStatus

class DomainCreate(BaseModel):
    name: str
    relationship: Optional[str] = "own"

class DomainResponse(BaseModel):
    id: uuid.UUID
    name: str
    status: DomainStatus
    verification_token: Optional[str] = None
    ownership_verified: bool = False
    verified_at: Optional[datetime] = None
    added_by_id: Optional[uuid.UUID] = None
    last_discovery_at: Optional[datetime] = None
    dns_records: Optional[dict] = None
    security_checks: Optional[dict] = None
    active_recon_state: str
    last_active_recon_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    relationship: str = "own"

    class Config:
        from_attributes = True
