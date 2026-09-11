import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any, Optional

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.services.threat_landscape_engine import calculate_threat_landscape_matches, generate_daily_briefing

router = APIRouter(prefix="/organizations/{org_id}/threat-landscape", tags=["threat-landscape"])

@router.get("/briefing")
async def get_threat_briefing(
    org_id: uuid.UUID,
    domain_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if str(current_user.organization_id) != str(org_id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    briefing = await generate_daily_briefing(db, org_id, domain_id)
    return {
        "id": str(briefing.id),
        "date": briefing.briefing_date.isoformat(),
        "content": briefing.content,
        "generated_by": briefing.generated_by
    }

@router.get("/actors")
async def get_threat_actors(
    org_id: uuid.UUID,
    domain_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if str(current_user.organization_id) != str(org_id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    matches = await calculate_threat_landscape_matches(db, org_id, domain_id)
    return matches
