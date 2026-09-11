from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ComplianceRiskDetail(BaseModel):
    id: str
    rule_key: str
    title: str
    asset_target: Optional[str]

class ComplianceControlResponse(BaseModel):
    control_id: str
    domain: str
    title: str
    mapped_rule_keys: List[str]
    status: str  # "conforme", "non_conforme", "non_evaluable"
    open_risks_count: int
    open_risks_details: List[ComplianceRiskDetail] = []
    message: Optional[str] = None
    dnssi_class: Optional[str] = None

class ComplianceFrameworkResponse(BaseModel):
    framework_key: str
    name: str
    authority: str
    controls: List[ComplianceControlResponse]
    score: float
    compliant_total: int
    evaluable_total: int
    non_evaluable_total: int
    evaluated_at: datetime
