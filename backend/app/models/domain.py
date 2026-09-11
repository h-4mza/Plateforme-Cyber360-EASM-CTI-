import uuid
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column, relationship as orm_relationship
from sqlalchemy import String, ForeignKey, Enum, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from app.models.base import Base, BaseMixin
import enum
from typing import List, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User
    from app.models.asset import Asset

class DomainStatus(str, enum.Enum):
    pending = "pending"
    discovering = "discovering"
    active = "active"
    error = "error"

class Domain(BaseMixin, Base):
    __tablename__ = "domains"
    __table_args__ = (UniqueConstraint("organization_id", "name", name="uq_domain_org_name"),)

    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[DomainStatus] = mapped_column(Enum(DomainStatus), default=DomainStatus.pending, nullable=False)
    verification_token: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ownership_verified: Mapped[bool] = mapped_column(default=False, server_default='false', nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    added_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    last_discovery_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dns_records: Mapped[dict | None] = mapped_column(type_=JSONB, nullable=True)
    security_checks: Mapped[dict | None] = mapped_column(type_=JSONB, nullable=True)
    active_recon_state: Mapped[str] = mapped_column(String(50), default="idle", server_default="idle", nullable=False)
    last_active_recon_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    relationship: Mapped[str] = mapped_column(String(50), default="own", server_default="own", nullable=False)

    organization: Mapped["Organization"] = orm_relationship("Organization", back_populates="domains")
    added_by: Mapped["User"] = orm_relationship("User")
    assets: Mapped[List["Asset"]] = orm_relationship("Asset", back_populates="domain", cascade="all, delete-orphan")
