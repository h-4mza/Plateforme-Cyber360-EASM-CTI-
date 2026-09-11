import uuid
from sqlalchemy import Column, Integer, Date, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from datetime import date
from app.models.base import Base

class ScoreSnapshot(Base):
    __tablename__ = 'score_snapshots'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False)
    date = Column(Date, default=date.today, nullable=False)
    
    score_global = Column(Integer, nullable=False)
    score_dns = Column(Integer, nullable=False)
    score_tls = Column(Integer, nullable=False)
    score_messagerie = Column(Integer, nullable=False)
    score_services = Column(Integer, nullable=False)
    score_configuration = Column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint('organization_id', 'date', name='uq_org_date'),
    )
