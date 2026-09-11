import json
import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.risk import Risk
from app.dependencies import get_current_user
from app.schemas.compliance import ComplianceFrameworkResponse, ComplianceControlResponse, ComplianceRiskDetail

router = APIRouter()

def load_compliance_frameworks():
    filepath = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "compliance_frameworks.json")
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading compliance frameworks: {e}")
        return {}

def load_risk_rules():
    filepath = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "risk_rules_content.json")
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def compute_compliance(organization_id: str, frameworks_data: dict, open_risks: List[Risk], risk_rules: dict) -> List[ComplianceFrameworkResponse]:
    responses = []
    now = datetime.now(timezone.utc)
    
    # Pre-group risks by rule_key
    risks_by_rule = {}
    for r in open_risks:
        if r.rule_key not in risks_by_rule:
            risks_by_rule[r.rule_key] = []
        risks_by_rule[r.rule_key].append(r)
        
    for fw_key, fw_data in frameworks_data.items():
        controls = []
        compliant_total = 0
        evaluable_total = 0
        non_evaluable_total = 0
        
        for ctrl in fw_data.get("controls", []):
            mapped_keys = ctrl.get("mapped_rule_keys", [])
            open_risks_details = []
            
            if not mapped_keys:
                status = "non_evaluable"
                non_evaluable_total += 1
                message = "Nécessite un audit humain complémentaire (contrôle organisationnel non évaluable techniquement)."
            else:
                evaluable_total += 1
                message = None
                
                # Gather risks for mapped keys
                for rk in mapped_keys:
                    if rk in risks_by_rule:
                        for risk_obj in risks_by_rule[rk]:
                            title = risk_rules.get(rk, {}).get("title", rk)
                            # get asset target
                            asset_target = risk_obj.asset.hostname or risk_obj.asset.ip_address if risk_obj.asset else None
                            open_risks_details.append(ComplianceRiskDetail(
                                id=str(risk_obj.id),
                                rule_key=rk,
                                title=title,
                                asset_target=asset_target
                            ))
                
                if len(open_risks_details) > 0:
                    status = "non_conforme"
                else:
                    status = "conforme"
                    compliant_total += 1
            
            controls.append(ComplianceControlResponse(
                control_id=ctrl.get("control_id", ""),
                domain=ctrl.get("domain", ""),
                title=ctrl.get("title", ""),
                mapped_rule_keys=mapped_keys,
                status=status,
                open_risks_count=len(open_risks_details),
                open_risks_details=open_risks_details,
                message=message,
                dnssi_class=ctrl.get("dnssi_class")
            ))
            
        score = (compliant_total / evaluable_total * 100) if evaluable_total > 0 else 0.0
        
        responses.append(ComplianceFrameworkResponse(
            framework_key=fw_key,
            name=fw_data.get("name", ""),
            authority=fw_data.get("authority", ""),
            controls=controls,
            score=round(score, 1),
            compliant_total=compliant_total,
            evaluable_total=evaluable_total,
            non_evaluable_total=non_evaluable_total,
            evaluated_at=now
        ))
        
    return responses

@router.get("/organizations/{org_id}/compliance", response_model=List[ComplianceFrameworkResponse])
async def get_organization_compliance(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if str(current_user.organization_id) != org_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this organization's compliance")

    frameworks_data = load_compliance_frameworks()
    risk_rules = load_risk_rules()
    
    # Fetch all OPEN risks for this organization
    stmt = select(Risk).where(Risk.organization_id == org_id, Risk.status == "open").options(selectinload(Risk.asset))
    result = await db.execute(stmt)
    open_risks = result.scalars().all()
    
    return compute_compliance(org_id, frameworks_data, open_risks, risk_rules)
