from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

class AssetBase(BaseModel):
    type: str
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    status: str = "active"
    domain_id: uuid.UUID
    technology: Optional[str] = None
    criticality: str = "medium"
    cert_subject: Optional[str] = None
    cert_issuer: Optional[str] = None
    cert_expires_at: Optional[datetime] = None
    cert_san: Optional[str] = None
    cert_status: Optional[str] = None
    http_redirect_status: Optional[str] = None
    is_eol: bool = False
    eol_since: Optional[datetime] = None

class AssetResponse(AssetBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    open_risks_count: int = 0

    model_config = {"from_attributes": True}
