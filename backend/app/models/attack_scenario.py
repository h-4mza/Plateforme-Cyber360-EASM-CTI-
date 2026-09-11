import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime, timezone
from sqlalchemy import Integer
from app.models.base import Base

class AttackScenarioDetected(Base):
    __tablename__ = "attack_scenarios_detected"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    scenario_key = Column(String, nullable=False)
    status = Column(String, nullable=False, default="open") # open, resolved
    risk_ids = Column(JSON, nullable=False, default=list) # List of risk UUIDs involved
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    likelihood_score = Column(Integer, default=0)
    severity_score = Column(Integer, default=0)
    kill_chain_stage_reached = Column(Integer, default=0)
    kill_chain_total_stages = Column(Integer, default=0)
    attack_path = Column(JSONB, nullable=True)
    relevant_attack_groups = Column(JSONB, nullable=True)

    __table_args__ = (
        UniqueConstraint('organization_id', 'scenario_key', name='uix_org_scenario'),
    )
