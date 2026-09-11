from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

class ScenarioRiskDetail(BaseModel):
    id: uuid.UUID
    rule_key: str
    asset_target: Optional[str]
    attack_techniques: List[str] = []

class AttackScenarioResponse(BaseModel):
    id: uuid.UUID
    scenario_key: str
    title: str
    severity: str
    explanation: str
    status: str
    created_at: datetime
    risks: List[ScenarioRiskDetail]
    severity_score: Optional[int] = 0
    likelihood_score: Optional[int] = 0

class ScenarioPathNode(BaseModel):
    id: str
    name: str
    type: str

class ScenarioPathEdge(BaseModel):
    source: str
    target: str
    rule_key: Optional[str] = None
    stage: int

class ScenarioPathMeta(BaseModel):
    likelihood_score: int
    severity_score: int
    kill_chain_stage_reached: int
    kill_chain_total_stages: int
    relevant_attack_groups: List[str]

class ScenarioPathResponse(BaseModel):
    nodes: List[ScenarioPathNode]
    edges: List[ScenarioPathEdge]
    meta: ScenarioPathMeta
