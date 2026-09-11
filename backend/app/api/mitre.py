import json
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.risk import Risk
from app.dependencies import get_current_user
from app.schemas.mitre import MitreTechniqueResponse

router = APIRouter()

MITRE_NAMES = {
    "T1590.002": "Gather Victim Network Information: DNS",
    "T1584.001": "Compromise Infrastructure: Domains",
    "T1566": "Phishing",
    "T1133": "External Remote Services",
    "T1190": "Exploit Public-Facing Application",
    "T1590": "Gather Victim Network Information",
    "T1592": "Gather Victim Host Information"
}

def load_risk_rules():
    filepath = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "risk_rules_content.json")
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

@router.get("/organizations/{org_id}/mitre-attack", response_model=List[MitreTechniqueResponse])
async def get_mitre_attack(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if str(current_user.organization_id) != org_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    risk_rules = load_risk_rules()
    
    stmt = select(Risk).where(Risk.organization_id == org_id, Risk.status == "open")
    result = await db.execute(stmt)
    open_risks = result.scalars().all()

    technique_counts = {}

    for risk in open_risks:
        rule = risk_rules.get(risk.rule_key, {})
        techniques = rule.get("attack_techniques", [])
        for t in techniques:
            technique_counts[t] = technique_counts.get(t, 0) + 1

    responses = []
    for t_id, count in technique_counts.items():
        responses.append(MitreTechniqueResponse(
            technique_id=t_id,
            name=MITRE_NAMES.get(t_id, "Technique MITRE"),
            risks_count=count
        ))
        
    return responses
