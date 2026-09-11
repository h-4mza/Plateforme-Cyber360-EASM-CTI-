import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SQLAlchemyEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime, timezone
from app.models.base import Base
from app.models.risk import RiskSeverity

class ThreatIntelFinding(Base):
    __tablename__ = 'threat_intel_findings'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    asset_id = Column(UUID(as_uuid=True), ForeignKey('assets.id', ondelete='CASCADE'), nullable=True)
    
    source = Column(String, nullable=False) # e.g. 'virustotal', 'abuseipdb'
    finding_type = Column(String, nullable=False) # e.g. 'malicious_ip', 'cve'
    severity = Column(SQLAlchemyEnum(RiskSeverity), nullable=False)
    
    raw_data = Column(JSONB, nullable=True)
    detected_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
