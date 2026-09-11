import uuid
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, Enum, DateTime, Index
from sqlalchemy.dialects.postgresql import JSONB
from app.models.base import Base
import enum
from typing import List, TYPE_CHECKING
from sqlalchemy import func

if TYPE_CHECKING:
    from app.models.asset import Asset
    from app.models.risk import Risk

class CheckResult(str, enum.Enum):
    pass_ = "pass"
    fail = "fail"
    warning = "warning"
    error = "error"
    unknown = "unknown"

class Check(Base):
    __tablename__ = "checks"
    __table_args__ = (
        Index("ix_checks_asset_type_executed", "asset_id", "type", "executed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id"), nullable=False)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    result: Mapped[CheckResult] = mapped_column(Enum(CheckResult), nullable=False)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    changed_from_previous: Mapped[str | None] = mapped_column(String(50), nullable=True)
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    asset: Mapped["Asset"] = relationship("Asset", back_populates="checks")
