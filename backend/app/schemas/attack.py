from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime

class MitreMitigation(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: Optional[str] = None

class MitreSoftware(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    type: Optional[str] = None
    description: Optional[str] = None

class MitreGroup(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: Optional[str] = None

class MitreTechniqueBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    is_subtechnique: bool
    parent_technique_id: Optional[str] = None
    description: Optional[str] = None

class MatrixTechnique(MitreTechniqueBase):
    active_risks_count: int = 0
    exposure_level: str = "none"

class MatrixTactic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    short_name: str
    techniques: List[MatrixTechnique] = []

class AttackMatrixResponse(BaseModel):
    tactics: List[MatrixTactic]

class TechniqueRiskDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    rule_key: str
    severity: str
    asset_name: str
    first_detected_at: datetime

class TechniqueDetailResponse(MitreTechniqueBase):
    tactics: List[str]
    mitigations: List[MitreMitigation]
    groups: List[MitreGroup]
    active_risks: List[TechniqueRiskDetail]

class GroupDetailResponse(MitreGroup):
    techniques: List[MitreTechniqueBase]
    software: List[MitreSoftware]
    exposure_score: Optional[Dict[str, Any]] = None

class AttackCoverageResponse(BaseModel):
    covered_tactics_count: int
    total_tactics: int
    matrix_exposed_percentage: float
    top_techniques: List[MatrixTechnique]
    top_groups: List[Dict[str, Any]]
