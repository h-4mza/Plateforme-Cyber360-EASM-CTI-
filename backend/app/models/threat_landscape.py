from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, ForeignKey, Date, func
from sqlalchemy.dialects.postgresql import JSONB
from app.models.base import Base, BaseMixin
from datetime import date
import uuid

class ThreatActorProfile(BaseMixin, Base):
    __tablename__ = "threat_actor_profiles"
    
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    targeted_sectors: Mapped[list] = mapped_column(JSONB, nullable=False, server_default='[]')
    targeted_regions: Mapped[list] = mapped_column(JSONB, nullable=False, server_default='[]')
    mitre_techniques: Mapped[list] = mapped_column(JSONB, nullable=False, server_default='[]')
    last_known_activity: Mapped[date | None] = mapped_column(Date, nullable=True)
    source_ref: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)


class ThreatLandscapeBriefing(BaseMixin, Base):
    __tablename__ = "threat_landscape_briefings"
    
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    domain_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("domains.id", ondelete="CASCADE"), nullable=True)
    briefing_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    content: Mapped[dict] = mapped_column(JSONB, nullable=False)
    generated_by: Mapped[str] = mapped_column(String(50), nullable=False, default="llm") # 'llm' or 'static'
