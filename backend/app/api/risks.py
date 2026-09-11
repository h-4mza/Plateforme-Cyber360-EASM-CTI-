from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
import uuid
from typing import List, Optional
import json
import os

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.risk import Risk
from app.models.asset import Asset
from app.models.domain import Domain
from app.schemas.risk import RiskResponse

router = APIRouter()

RISK_RULES_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "risk_rules_content.json")

def load_risk_configs():
    with open(RISK_RULES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def enrich_risk(risk_obj: Risk, configs: dict, asset_target: str = None, domain_id: str = None, domain_name: str = None):
    config = configs.get(risk_obj.rule_key, {})
    return {
        "id": risk_obj.id,
        "organization_id": risk_obj.organization_id,
        "asset_id": risk_obj.asset_id,
        "rule_key": risk_obj.rule_key,
        "severity": risk_obj.severity,
        "status": risk_obj.status,
        "first_detected_at": risk_obj.first_detected_at,
        "last_seen_at": risk_obj.last_seen_at,
        "resolved_at": risk_obj.resolved_at,
        "title": config.get("title", "Inconnu"),
        "category": config.get("category", "inconnu"),
        "explanation": config.get("explanation", ""),
        "impact": config.get("impact", ""),
        "recommendation": config.get("recommendation", ""),
        "asset_target": asset_target,
        "domain_id": domain_id,
        "domain_name": domain_name,
        "details": risk_obj.details,
        "is_active_recon": risk_obj.rule_key in [
            "dns_zone_transfer_exposed",
            "sensitive_file_exposed",
            "security_txt_missing",
            "subdomain_takeover_possible",
            "origin_ip_exposed"
        ]
    }

@router.get("/organizations/{org_id}/risks", response_model=List[RiskResponse])
async def list_org_risks(
    org_id: uuid.UUID,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    category: Optional[str] = None,
    asset_id: Optional[uuid.UUID] = None,
    has_ai: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if str(current_user.organization_id) != str(org_id):
        raise HTTPException(status_code=403, detail="Not authorized")
            
    stmt = select(Risk, Asset, Domain).join(Asset, Risk.asset_id == Asset.id).outerjoin(Domain, Asset.domain_id == Domain.id).where(Risk.organization_id == org_id)
    
    if status:
        stmt = stmt.where(Risk.status == status)
    if severity:
        stmt = stmt.where(Risk.severity == severity)
    if asset_id:
        stmt = stmt.where(Risk.asset_id == asset_id)
    if has_ai is True:
        from app.models.ai_copilot import RiskAICopilotResult
        stmt = stmt.join(RiskAICopilotResult, Risk.id == RiskAICopilotResult.risk_id)
        
    result = await db.execute(stmt)
    rows = result.all()
    
    configs = load_risk_configs()
    enriched = [enrich_risk(r[0], configs, r[1].hostname or r[1].ip_address, r[2].id if r[2] else None, r[2].name if r[2] else None) for r in rows]
    
    if category:
        enriched = [r for r in enriched if r["category"] == category]
        
    severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    enriched.sort(key=lambda x: severity_order.get(x["severity"], 0), reverse=True)
    
    return enriched

@router.get("/risks/{risk_id}", response_model=RiskResponse)
async def get_risk(
    risk_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Risk, Asset, Domain).join(Asset, Risk.asset_id == Asset.id).outerjoin(Domain, Asset.domain_id == Domain.id).where(
        and_(
            Risk.id == risk_id,
            Risk.organization_id == current_user.organization_id
        )
    )
    result = await db.execute(stmt)
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Risk not found")
        
    configs = load_risk_configs()
    return enrich_risk(row[0], configs, row[1].hostname or row[1].ip_address, row[2].id if row[2] else None, row[2].name if row[2] else None)

from pydantic import BaseModel
from datetime import datetime, timezone

class BulkResolvePayload(BaseModel):
    risk_ids: List[str]

@router.post("/organizations/{org_id}/risks/bulk-resolve")
async def bulk_resolve_risks(
    org_id: uuid.UUID,
    payload: BulkResolvePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if str(current_user.organization_id) != str(org_id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if current_user.role == "readonly":
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    stmt = select(Risk).where(
        and_(
            Risk.id.in_([uuid.UUID(rid) for rid in payload.risk_ids]),
            Risk.organization_id == org_id
        )
    )
    result = await db.execute(stmt)
    risks = result.scalars().all()
    
    now = datetime.now(timezone.utc)
    resolved_count = 0
    for r in risks:
        if r.status != 'resolved':
            r.status = 'resolved'
            r.resolved_at = now
            resolved_count += 1
            
    await db.commit()
    return {"resolved_count": resolved_count}

from app.models.ai_copilot import RiskAICopilotResult, AILog
from app.schemas.ai_copilot import RiskAICopilotResponse, ValidateTechniqueRequest
from app.services.ai_copilot import analyze_risk_with_ai
from sqlalchemy.orm import selectinload
from sqlalchemy import func

import redis.asyncio as redis_async

@router.post("/risks/{risk_id}/ai-analysis", response_model=RiskAICopilotResponse)
async def analyze_risk(
    risk_id: uuid.UUID,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Risk).where(and_(Risk.id == risk_id, Risk.organization_id == current_user.organization_id))
    risk = await db.scalar(stmt)
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")
        
    # Vérification du quota journalier global (Max = 50 par défaut pour le budget stage)
    max_daily = int(os.environ.get("MAX_AI_ANALYSES_PER_DAY", "50"))
    today = datetime.now(timezone.utc).date()
    stmt_count = select(func.count(AILog.id)).where(func.date(AILog.created_at) == today)
    daily_usage = await db.scalar(stmt_count)
    if daily_usage >= max_daily:
        return {"risk_id": risk_id, "status": "failed", "error": "Quota journalier d'analyses IA atteint."}

    # Vérification proactive du Rate Limit Gemini Free Tier (15 Req / Minute) via Redis
    redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
    try:
        r = redis_async.from_url(redis_url)
        rpm_key = "gemini_api_rpm_counter"
        current_rpm = await r.incr(rpm_key)
        if current_rpm == 1:
            await r.expire(rpm_key, 60) # Fenêtre de 60 secondes
        await r.aclose() # Ferme la connexion proprement
        
        if current_rpm > 15:
            return {"risk_id": risk_id, "status": "failed", "error": "Protection Anti-Spam (Tier Gratuit) : Limite de 15 requêtes par minute atteinte. Veuillez patienter une minute."}
    except Exception as e:
        print(f"Erreur redis pour rate limit : {e}")
        pass # Fallback : si redis échoue, on tente quand même, le fallback du 429 prendra le relai.

    if not force:
        stmt_ai = select(RiskAICopilotResult).where(RiskAICopilotResult.risk_id == risk_id)
        existing = await db.scalar(stmt_ai)
        if existing:
            return existing
            
    # Appel de l'IA (qui gère ses propres logs et exceptions internes)
    ai_result = await analyze_risk_with_ai(risk_id, db)
    
    if ai_result["status"] == "failed":
        # On renvoie 200 avec status="failed", on ne sauvegarde RIEN dans RiskAICopilotResult
        return {"risk_id": risk_id, "status": "failed", "error": ai_result["error"]}
        
    analysis = ai_result["payload"]
    model_used = ai_result["model"]
        
    stmt_ai = select(RiskAICopilotResult).where(RiskAICopilotResult.risk_id == risk_id)
    existing = await db.scalar(stmt_ai)
    if existing:
        existing.payload = analysis.model_dump()
        existing.model_used = model_used
        existing.generated_at = datetime.now(timezone.utc)
        existing.validated_by_user = False
        result = existing
    else:
        result = RiskAICopilotResult(
            risk_id=risk_id,
            payload=analysis.model_dump(),
            model_used=model_used
        )
        db.add(result)
        
    await db.commit()
    await db.refresh(result)
    return result

from app.models.attack import AttackTechnique

@router.post("/risks/{risk_id}/ai-analysis/validate-technique")
async def validate_technique(
    risk_id: uuid.UUID,
    payload: ValidateTechniqueRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Risk).options(selectinload(Risk.techniques)).where(and_(Risk.id == risk_id, Risk.organization_id == current_user.organization_id))
    risk = await db.scalar(stmt)
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")
        
    stmt_tech = select(AttackTechnique).where(AttackTechnique.id == payload.technique_id)
    tech = await db.scalar(stmt_tech)
    if not tech:
        raise HTTPException(status_code=404, detail="Technique not found")
        
    if tech not in risk.techniques:
        risk.techniques.append(tech)
        await db.commit()
        
    return {"status": "success"}
