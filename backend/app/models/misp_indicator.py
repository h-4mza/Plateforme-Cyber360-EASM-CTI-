import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base

class MispIndicator(Base):
    __tablename__ = "misp_indicators"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    misp_attribute_id = Column(String, index=True, unique=True, nullable=False)
    misp_event_id = Column(String, index=True, nullable=False)
    indicator_type = Column(String, index=True, nullable=False)  # ip, domain, hash, url
    value = Column(String, index=True, nullable=False)
    threat_level = Column(String, nullable=True)
    event_tags = Column(JSON, default=list)
    first_seen = Column(DateTime(timezone=True), nullable=True)
    last_synced_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
