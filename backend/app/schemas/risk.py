from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
from app.models.risk import RiskStatus, RiskSeverity

class RiskBase(BaseModel):
    rule_key: str
    severity: RiskSeverity
    status: RiskStatus
    asset_id: uuid.UUID

class RiskResponse(RiskBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    first_detected_at: datetime
    last_seen_at: datetime
    resolved_at: Optional[datetime] = None
    
    # Enrichment from JSON
    title: str
    category: str
    explanation: str
    impact: str
    recommendation: str
    asset_target: Optional[str] = None
    domain_id: Optional[uuid.UUID] = None
    domain_name: Optional[str] = None
    details: Optional[dict] = None
    is_active_recon: bool = False

    model_config = {"from_attributes": True}
