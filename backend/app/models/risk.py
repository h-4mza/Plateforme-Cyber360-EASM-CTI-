import uuid
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, Enum, DateTime, UniqueConstraint
from app.models.base import Base, BaseMixin
import enum
from typing import List, TYPE_CHECKING
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import JSONB

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.alert import Alert

class RiskSeverity(str, enum.Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"

class RiskStatus(str, enum.Enum):
    open = "open"
    resolved = "resolved"

class Risk(BaseMixin, Base):
    __tablename__ = "risks"
    __table_args__ = (
        UniqueConstraint("asset_id", "rule_key", name="uq_risk_asset_rule"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    rule_key: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[RiskSeverity] = mapped_column(Enum(RiskSeverity), nullable=False)
    status: Mapped[RiskStatus] = mapped_column(Enum(RiskStatus), default=RiskStatus.open, nullable=False)
    first_detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    details: Mapped[dict | None] = mapped_column(type_=JSONB, nullable=True)

    asset: Mapped["Asset"] = relationship("Asset", back_populates="risks")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="risk")
    ai_analysis = relationship("RiskAICopilotResult", back_populates="risk", uselist=False, cascade="all, delete-orphan")
    techniques = relationship("AttackTechnique", secondary="risk_technique_map")

from sqlalchemy import Table, Column
risk_technique_map = Table(
    "risk_technique_map",
    Base.metadata,
    Column("risk_id", ForeignKey("risks.id", ondelete="CASCADE"), primary_key=True),
    Column("technique_id", String, ForeignKey("attack_techniques.id", ondelete="CASCADE"), primary_key=True)
)
