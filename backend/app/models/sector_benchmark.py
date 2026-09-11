import uuid
from sqlalchemy import Column, String, Integer, Float, DateTime
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
from app.models.base import Base

class SectorBenchmarkAggregate(Base):
    __tablename__ = "sector_benchmarks_aggregate"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sector = Column(String, nullable=False, index=True)
    metric_type = Column(String, nullable=False)
    percentile_25 = Column(Float, nullable=False)
    percentile_50 = Column(Float, nullable=False)
    percentile_75 = Column(Float, nullable=False)
    sample_size = Column(Integer, nullable=False)
    computed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
