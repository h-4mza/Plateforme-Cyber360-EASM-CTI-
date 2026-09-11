import uuid
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, ForeignKey, Enum, DateTime, Text, UniqueConstraint
from app.models.base import Base, BaseMixin
import enum
from typing import List, TYPE_CHECKING
from sqlalchemy import func

if TYPE_CHECKING:
    from app.models.domain import Domain
    from app.models.check import Check
    from app.models.risk import Risk

class AssetType(str, enum.Enum):
    root_domain = "root_domain"
    subdomain = "subdomain"
    ip = "ip"
    certificate = "certificate"

class AssetStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    expired = "expired"
    unreachable = "unreachable"

class AssetStatusLog(BaseMixin, Base):
    __tablename__ = "asset_status_logs"

    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    old_status: Mapped[str] = mapped_column(String(50), nullable=False)
    new_status: Mapped[str] = mapped_column(String(50), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class AssetCriticality(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"

class Asset(BaseMixin, Base):
    __tablename__ = "assets"
    __table_args__ = (
        UniqueConstraint("domain_id", "hostname", "ip_address", name="uq_asset_dedup"),
    )

    domain_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("domains.id"), nullable=False)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    hostname: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    type: Mapped[AssetType] = mapped_column(Enum(AssetType), nullable=False)
    status: Mapped[AssetStatus] = mapped_column(Enum(AssetStatus), default=AssetStatus.active, nullable=False)
    technology: Mapped[str | None] = mapped_column(String(255), nullable=True)
    criticality: Mapped[AssetCriticality] = mapped_column(Enum(AssetCriticality), default=AssetCriticality.medium, nullable=False)

    is_eol: Mapped[bool] = mapped_column(default=False, nullable=False, server_default='false')
    eol_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    cert_subject: Mapped[str | None] = mapped_column(String, nullable=True)
    cert_issuer: Mapped[str | None] = mapped_column(String, nullable=True)
    cert_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cert_san: Mapped[str | None] = mapped_column(Text, nullable=True)
    cert_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    http_redirect_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    discovered_via: Mapped[str | None] = mapped_column(String(100), nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    next_check_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    domain: Mapped["Domain"] = relationship("Domain", back_populates="assets")
    checks: Mapped[List["Check"]] = relationship("Check", back_populates="asset", cascade="all, delete-orphan")
    risks: Mapped[List["Risk"]] = relationship("Risk", back_populates="asset", cascade="all, delete-orphan")
    ai_analysis: Mapped["AssetAICopilotResult"] = relationship("AssetAICopilotResult", back_populates="asset", uselist=False, cascade="all, delete-orphan")
