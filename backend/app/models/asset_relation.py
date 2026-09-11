import uuid
import enum
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey, Enum, Float, DateTime, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.models.base import Base

class AssetRelationType(str, enum.Enum):
    shared_ip = "shared_ip"
    shared_tls_cert_san = "shared_tls_cert_san"
    same_root_domain = "same_root_domain"
    dns_cname_chain = "dns_cname_chain"
    shared_hosting_asn = "shared_hosting_asn"
    subdomain_naming_pattern = "subdomain_naming_pattern"

class AssetRelation(Base):
    __tablename__ = "asset_relations"
    __table_args__ = (
        UniqueConstraint("source_asset_id", "target_asset_id", name="uq_asset_relation_source_target"),
        Index("ix_asset_relation_source_target", "source_asset_id", "target_asset_id"),
        Index("ix_asset_relation_type", "relation_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    target_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    relation_type: Mapped[AssetRelationType] = mapped_column(Enum(AssetRelationType), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    evidence: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    source_asset = relationship("Asset", foreign_keys=[source_asset_id])
    target_asset = relationship("Asset", foreign_keys=[target_asset_id])
