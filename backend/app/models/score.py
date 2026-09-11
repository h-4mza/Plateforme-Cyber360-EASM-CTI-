import uuid
from datetime import datetime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import ForeignKey, DateTime, Integer, CheckConstraint
from sqlalchemy.dialects.postgresql import JSONB
from app.models.base import Base
from typing import TYPE_CHECKING
from sqlalchemy import func

if TYPE_CHECKING:
    from app.models.organization import Organization

class Score(Base):
    __tablename__ = "scores"
    __table_args__ = (
        CheckConstraint("overall_score >= 0 AND overall_score <= 100", name="chk_score_overall"),
        CheckConstraint("dns_score >= 0 AND dns_score <= 100", name="chk_score_dns"),
        CheckConstraint("tls_score >= 0 AND tls_score <= 100", name="chk_score_tls"),
        CheckConstraint("email_score >= 0 AND email_score <= 100", name="chk_score_email"),
        CheckConstraint("services_score >= 0 AND services_score <= 100", name="chk_score_services"),
        CheckConstraint("config_score >= 0 AND config_score <= 100", name="chk_score_config"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False)
    dns_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tls_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    email_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    services_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    config_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    organization: Mapped["Organization"] = relationship("Organization", back_populates="scores")
