import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, ForeignKey, JSON, DateTime, func, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB

from .base import Base, BaseMixin

class RiskAICopilotResult(Base, BaseMixin):
    __tablename__ = "risk_ai_copilot_results"

    risk_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("risks.id", ondelete="CASCADE"), unique=True)
    payload: Mapped[dict] = mapped_column(JSONB)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    model_used: Mapped[str] = mapped_column(String)
    validated_by_user: Mapped[bool] = mapped_column(Boolean, default=False)
    
    risk = relationship("Risk", back_populates="ai_analysis")

class AssetAICopilotResult(Base, BaseMixin):
    __tablename__ = "asset_ai_copilot_results"

    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"), unique=True)
    payload: Mapped[dict] = mapped_column(JSONB)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    model_used: Mapped[str] = mapped_column(String)
    
    asset = relationship("Asset", back_populates="ai_analysis")
class AILog(Base, BaseMixin):
    __tablename__ = "ai_logs"

    endpoint: Mapped[str] = mapped_column(String)
    model: Mapped[str] = mapped_column(String)
    latency_ms: Mapped[int] = mapped_column(Integer)
    # optional prompt/response sizes
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=True)
    cost_usd: Mapped[float] = mapped_column(Float, nullable=True)
