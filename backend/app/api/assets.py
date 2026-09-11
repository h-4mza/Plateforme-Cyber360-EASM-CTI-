from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
import uuid
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.asset import Asset, AssetCriticality
from app.schemas.asset import AssetResponse
from pydantic import BaseModel

router = APIRouter()

class AssetUpdate(BaseModel):
    criticality: Optional[AssetCriticality] = None
    status: Optional[str] = None

@router.get("", response_model=List[AssetResponse])
async def list_assets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    type: Optional[str] = None,
    criticality: Optional[str] = None
):
    from app.models.risk import Risk, RiskStatus
    from sqlalchemy import func
    
    subq = select(func.count(Risk.id)).where(
        Risk.asset_id == Asset.id,
        Risk.status == RiskStatus.open
    ).scalar_subquery()
    
    stmt = select(Asset, subq.label("open_risks_count")).where(Asset.organization_id == current_user.organization_id)
    
    if search:
        search_filter = f"%{search}%"
        stmt = stmt.where(
            or_(
                Asset.hostname.ilike(search_filter),
                Asset.ip_address.ilike(search_filter),
                Asset.technology.ilike(search_filter)
            )
        )
        
    if type:
        stmt = stmt.where(Asset.type == type)
        
    if criticality:
        stmt = stmt.where(Asset.criticality == criticality)
        
    stmt = stmt.order_by(Asset.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(stmt)
    rows = result.all()
    
    assets = []
    for asset_obj, count in rows:
        asset_obj.open_risks_count = count
        assets.append(asset_obj)
        
    return assets

@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.risk import Risk, RiskStatus
    from sqlalchemy import func
    
    subq = select(func.count(Risk.id)).where(
        Risk.asset_id == asset_id,
        Risk.status == RiskStatus.open
    ).scalar_subquery()
    
    stmt = select(Asset, subq.label("open_risks_count")).where(
        and_(
            Asset.id == asset_id,
            Asset.organization_id == current_user.organization_id
        )
    )
    result = await db.execute(stmt)
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    asset_obj, count = row
    asset_obj.open_risks_count = count
    return asset_obj


@router.patch("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: uuid.UUID,
    asset_update: AssetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "readonly":
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    stmt = select(Asset).where(
        and_(
            Asset.id == asset_id,
            Asset.organization_id == current_user.organization_id
        )
    )
    result = await db.execute(stmt)
    asset = result.scalar_one_or_none()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    if asset_update.criticality:
        asset.criticality = asset_update.criticality
        now = datetime.now(timezone.utc)
        from datetime import timedelta
        if asset.criticality == 'high':
            asset.next_check_due_at = now + timedelta(days=1)
        elif asset.criticality == 'medium':
            asset.next_check_due_at = now + timedelta(days=3)
        else:
            asset.next_check_due_at = now + timedelta(days=7)
            
    if asset_update.status:
        asset.status = asset_update.status
        
    await db.commit()
    await db.refresh(asset)
    return asset

from app.modules.monitoring.tasks import check_ports, check_tls, check_http_headers

@router.post("/{asset_id}/check-now")
async def force_check_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "readonly":
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    stmt = select(Asset).where(
        and_(
            Asset.id == asset_id,
            Asset.organization_id == current_user.organization_id
        )
    )
    result = await db.execute(stmt)
    asset = result.scalar_one_or_none()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    # Trigger checks immediately
    check_ports.delay(str(asset.id))
    if asset.hostname:
        check_tls.delay(str(asset.id))
        check_http_headers.delay(str(asset.id))
        
    return {"status": "Checks dispatched"}

from app.models.check import Check

@router.get("/{asset_id}/recent-checks")
async def get_recent_checks(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "readonly":
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    stmt = select(Asset).where(
        and_(
            Asset.id == asset_id,
            Asset.organization_id == current_user.organization_id
        )
    )
    result = await db.execute(stmt)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Asset not found")
        
    # Get checks from the last 5 minutes
    five_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
    stmt = select(Check).where(
        and_(
            Check.asset_id == asset_id,
            Check.executed_at >= five_mins_ago
        )
    ).order_by(Check.executed_at.desc())
    
    result = await db.execute(stmt)
    checks = result.scalars().all()
    
    return [{"type": c.type, "result": c.result, "executed_at": c.executed_at} for c in checks]

@router.get("/{asset_id}/history")
async def get_asset_history(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Asset).where(
        and_(
            Asset.id == asset_id,
            Asset.organization_id == current_user.organization_id
        )
    )
    result = await db.execute(stmt)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Asset not found")
        
    stmt = select(Check).where(
        Check.asset_id == asset_id
    ).order_by(Check.executed_at.desc()).limit(50)
    
    result = await db.execute(stmt)
    checks = result.scalars().all()
    
    return [{"id": c.id, "type": c.type, "result": c.result, "details": c.details, "executed_at": c.executed_at} for c in checks]


@router.get("/{asset_id}/shodan")
async def get_asset_shodan(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Asset).where(
        and_(
            Asset.id == asset_id,
            Asset.organization_id == current_user.organization_id
        )
    )
    result = await db.execute(stmt)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Asset not found")
        
    stmt = select(Check).where(
        and_(
            Check.asset_id == asset_id,
            Check.type == "ports"
        )
    ).order_by(Check.executed_at.desc()).limit(1)
    
    result = await db.execute(stmt)
    check = result.scalar_one_or_none()
    
    if check and check.details and "shodan" in check.details:
        return check.details["shodan"]
    
    return None

from app.models.asset_relation import AssetRelation

@router.get("/{asset_id}/relations")
async def get_asset_relations(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Asset).where(
        and_(
            Asset.id == asset_id,
            Asset.organization_id == current_user.organization_id
        )
    )
    result = await db.execute(stmt)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Asset not found")
        
    stmt = select(AssetRelation).where(
        or_(
            AssetRelation.source_asset_id == asset_id,
            AssetRelation.target_asset_id == asset_id
        )
    )
    
    result = await db.execute(stmt)
    relations = result.scalars().all()
    
    response = []
    
    # Preload related assets for names
    related_asset_ids = set()
    for r in relations:
        if r.source_asset_id != asset_id:
            related_asset_ids.add(r.source_asset_id)
        if r.target_asset_id != asset_id:
            related_asset_ids.add(r.target_asset_id)
            
    assets_map = {}
    if related_asset_ids:
        astmt = select(Asset).where(Asset.id.in_(related_asset_ids))
        aresult = await db.execute(astmt)
        for a in aresult.scalars().all():
            assets_map[a.id] = a.hostname or a.ip_address
            
    for r in relations:
        is_source = r.source_asset_id == asset_id
        linked_asset_id = r.target_asset_id if is_source else r.source_asset_id
        linked_asset_name = assets_map.get(linked_asset_id, str(linked_asset_id))
        
        response.append({
            "id": str(r.id),
            "relation_type": r.relation_type,
            "confidence": r.confidence,
            "is_source": is_source,
            "linked_asset_id": str(linked_asset_id),
            "linked_asset_name": linked_asset_name
        })
        
    return response

from app.models.ai_copilot import AssetAICopilotResult, AILog
from app.schemas.ai_copilot import AssetAICopilotResponse
from app.services.ai_copilot import analyze_asset_with_ai
import os
import redis.asyncio as redis_async

@router.post("/{asset_id}/ai-analysis", response_model=AssetAICopilotResponse)
async def analyze_asset(
    asset_id: uuid.UUID,
    force: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Asset).where(and_(Asset.id == asset_id, Asset.organization_id == current_user.organization_id))
    asset = await db.scalar(stmt)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    # Vérification du quota
    max_daily = int(os.environ.get("MAX_AI_ANALYSES_PER_DAY", "50"))
    today = datetime.now(timezone.utc).date()
    from sqlalchemy import func
    stmt_count = select(func.count(AILog.id)).where(func.date(AILog.created_at) == today)
    daily_usage = await db.scalar(stmt_count)
    if daily_usage >= max_daily:
        return {"asset_id": asset_id, "status": "failed", "error": "Quota journalier d'analyses IA atteint."}

    # Redis rate limit
    redis_url = os.environ.get("REDIS_URL", "redis://redis:6379/0")
    try:
        r = redis_async.from_url(redis_url)
        rpm_key = "gemini_api_rpm_counter"
        current_rpm = await r.incr(rpm_key)
        if current_rpm == 1:
            await r.expire(rpm_key, 60)
        await r.aclose()
        if current_rpm > 15:
            return {"asset_id": asset_id, "status": "failed", "error": "Limite de 15 requêtes par minute atteinte. Veuillez patienter."}
    except:
        pass

    if not force:
        stmt_ai = select(AssetAICopilotResult).where(AssetAICopilotResult.asset_id == asset_id)
        existing = await db.scalar(stmt_ai)
        if existing:
            return existing
            
    ai_result = await analyze_asset_with_ai(asset_id, db)
    
    if ai_result["status"] == "failed":
        return {"asset_id": asset_id, "status": "failed", "error": ai_result["error"]}
        
    analysis = ai_result["payload"]
    model_used = ai_result["model"]
        
    stmt_ai = select(AssetAICopilotResult).where(AssetAICopilotResult.asset_id == asset_id)
    existing = await db.scalar(stmt_ai)
    if existing:
        existing.payload = analysis.model_dump()
        existing.model_used = model_used
        existing.generated_at = datetime.now(timezone.utc)
        result = existing
    else:
        result = AssetAICopilotResult(
            asset_id=asset_id,
            payload=analysis.model_dump(),
            model_used=model_used
        )
        db.add(result)
        
    await db.commit()
    await db.refresh(result)
    return result
