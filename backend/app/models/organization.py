from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String
from app.models.base import Base, BaseMixin
from typing import List, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.invitation import Invitation
    from app.models.domain import Domain
    from app.models.score import Score
    from app.models.report import Report
    from app.models.alert import Alert

class Organization(BaseMixin, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    primary_contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    users: Mapped[List["User"]] = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    invitations: Mapped[List["Invitation"]] = relationship("Invitation", back_populates="organization", cascade="all, delete-orphan")
    domains: Mapped[List["Domain"]] = relationship("Domain", back_populates="organization", cascade="all, delete-orphan")
    scores: Mapped[List["Score"]] = relationship("Score", back_populates="organization", cascade="all, delete-orphan")
    reports: Mapped[List["Report"]] = relationship("Report", back_populates="organization", cascade="all, delete-orphan")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="organization", cascade="all, delete-orphan")
