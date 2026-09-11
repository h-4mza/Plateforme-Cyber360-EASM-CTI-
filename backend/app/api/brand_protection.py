from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Any, Dict
from app.dependencies import require_role
from app.models.user import User, UserRole
from app.models.threat_intel import ThreatIntelFinding
from app.database import get_db
from app.modules.threat_intel.brand_protection_tasks import (
    run_typosquatting_check,
    run_data_leak_check,
    monitor_certificate_transparency
)

router = APIRouter()

@router.get("/me")
async def get_my_brand_protection(
    current_user: User = Depends(require_role(UserRole.readonly)), 
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(ThreatIntelFinding)
        .where(
            ThreatIntelFinding.organization_id == current_user.organization_id,
            ThreatIntelFinding.finding_type.in_(["nouveau_certificat_detecte", "typosquatting", "data_leak_exposure"])
        )
        .order_by(ThreatIntelFinding.detected_at.desc())
    )
    result = await db.execute(stmt)
    findings = result.scalars().all()
    
    response = {
        "typosquatting": [],
        "certificates": [],
        "data_leaks": []
    }
    
    for f in findings:
        item = {
            "id": str(f.id),
            "severity": f.severity.value,
            "detected_at": f.detected_at.isoformat(),
            "raw_data": f.raw_data
        }
        if f.finding_type == "typosquatting":
            response["typosquatting"].append(item)
        elif f.finding_type == "nouveau_certificat_detecte":
            response["certificates"].append(item)
        elif f.finding_type == "data_leak_exposure":
            response["data_leaks"].append(item)
            
    return response

@router.post("/me/scan/typosquatting")
async def trigger_typosquatting_scan(current_user: User = Depends(require_role(UserRole.admin))):
    run_typosquatting_check.delay()
    return {"status": "ok", "message": "Scan typosquatting lancé."}

@router.post("/me/scan/leaks")
async def trigger_leaks_scan(current_user: User = Depends(require_role(UserRole.admin))):
    run_data_leak_check.delay()
    return {"status": "ok", "message": "Scan fuites de données lancé."}

@router.post("/me/scan/certificates")
async def trigger_certificates_scan(current_user: User = Depends(require_role(UserRole.admin))):
    monitor_certificate_transparency.delay()
    return {"status": "ok", "message": "Scan certificats lancé."}
