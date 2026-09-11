import enum
from datetime import datetime
from typing import List, Optional

from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey, Table, DateTime, Enum, Index
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

class AttackSoftwareType(str, enum.Enum):
    malware = "malware"
    tool = "tool"

# Many-to-Many association tables
attack_technique_tactics = Table(
    "attack_technique_tactics",
    Base.metadata,
    Column("technique_id", String, ForeignKey("attack_techniques.id", ondelete="CASCADE"), primary_key=True),
    Column("tactic_id", String, ForeignKey("attack_tactics.id", ondelete="CASCADE"), primary_key=True)
)

attack_group_techniques = Table(
    "attack_group_techniques",
    Base.metadata,
    Column("group_id", String, ForeignKey("attack_groups.id", ondelete="CASCADE"), primary_key=True),
    Column("technique_id", String, ForeignKey("attack_techniques.id", ondelete="CASCADE"), primary_key=True)
)

attack_software_techniques = Table(
    "attack_software_techniques",
    Base.metadata,
    Column("software_id", String, ForeignKey("attack_software.id", ondelete="CASCADE"), primary_key=True),
    Column("technique_id", String, ForeignKey("attack_techniques.id", ondelete="CASCADE"), primary_key=True)
)

attack_software_groups = Table(
    "attack_software_groups",
    Base.metadata,
    Column("software_id", String, ForeignKey("attack_software.id", ondelete="CASCADE"), primary_key=True),
    Column("group_id", String, ForeignKey("attack_groups.id", ondelete="CASCADE"), primary_key=True)
)

attack_technique_mitigations = Table(
    "attack_technique_mitigations",
    Base.metadata,
    Column("mitigation_id", String, ForeignKey("attack_mitigations.id", ondelete="CASCADE"), primary_key=True),
    Column("technique_id", String, ForeignKey("attack_techniques.id", ondelete="CASCADE"), primary_key=True)
)

class AttackTactic(Base):
    __tablename__ = "attack_tactics"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    short_name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    techniques: Mapped[List["AttackTechnique"]] = relationship(
        "AttackTechnique",
        secondary=attack_technique_tactics,
        back_populates="tactics"
    )

class AttackTechnique(Base):
    __tablename__ = "attack_techniques"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_subtechnique: Mapped[bool] = mapped_column(Boolean, default=False)
    parent_technique_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("attack_techniques.id"), nullable=True)
    
    platforms: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), nullable=True)
    data_sources: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), nullable=True)
    
    version: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    modified: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    tactics: Mapped[List["AttackTactic"]] = relationship(
        "AttackTactic",
        secondary=attack_technique_tactics,
        back_populates="techniques"
    )
    
    groups: Mapped[List["AttackGroup"]] = relationship(
        "AttackGroup",
        secondary=attack_group_techniques,
        back_populates="techniques"
    )
    
    software: Mapped[List["AttackSoftware"]] = relationship(
        "AttackSoftware",
        secondary=attack_software_techniques,
        back_populates="techniques"
    )
    
    mitigations: Mapped[List["AttackMitigation"]] = relationship(
        "AttackMitigation",
        secondary=attack_technique_mitigations,
        back_populates="techniques"
    )

class AttackGroup(Base):
    __tablename__ = "attack_groups"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    aliases: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    techniques: Mapped[List["AttackTechnique"]] = relationship(
        "AttackTechnique",
        secondary=attack_group_techniques,
        back_populates="groups"
    )
    
    software: Mapped[List["AttackSoftware"]] = relationship(
        "AttackSoftware",
        secondary=attack_software_groups,
        back_populates="used_by_groups"
    )

class AttackSoftware(Base):
    __tablename__ = "attack_software"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[Optional[AttackSoftwareType]] = mapped_column(Enum(AttackSoftwareType), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    techniques: Mapped[List["AttackTechnique"]] = relationship(
        "AttackTechnique",
        secondary=attack_software_techniques,
        back_populates="software"
    )
    
    used_by_groups: Mapped[List["AttackGroup"]] = relationship(
        "AttackGroup",
        secondary=attack_software_groups,
        back_populates="software"
    )

class AttackMitigation(Base):
    __tablename__ = "attack_mitigations"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    techniques: Mapped[List["AttackTechnique"]] = relationship(
        "AttackTechnique",
        secondary=attack_technique_mitigations,
        back_populates="mitigations"
    )

Index('ix_attack_techniques_id', AttackTechnique.id)
Index('ix_attack_groups_id', AttackGroup.id)
