from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.score_snapshot import ScoreSnapshot
from app.dependencies import get_current_user
from app.models.sector_benchmark import SectorBenchmarkAggregate
from app.schemas.benchmark import SectorBenchmarkResponse, OrgBenchmarkResponse

router = APIRouter()

@router.get("/benchmarks/{sector}", response_model=List[SectorBenchmarkResponse])
async def get_sector_benchmarks(
    sector: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(SectorBenchmarkAggregate).where(SectorBenchmarkAggregate.sector == sector).order_by(SectorBenchmarkAggregate.computed_at.desc()).limit(100)
    result = await db.execute(stmt)
    records = result.scalars().all()
    
    if not records:
        return []
    
    latest_time = max(r.computed_at for r in records)
    latest_records = [r for r in records if r.computed_at == latest_time]
    
    return [
        SectorBenchmarkResponse(
            sector=r.sector,
            metric_type=r.metric_type,
            percentile_25=r.percentile_25,
            percentile_50=r.percentile_50,
            percentile_75=r.percentile_75,
            sample_size=r.sample_size
        )
        for r in latest_records
    ]

@router.get("/organizations/{org_id}/benchmark", response_model=OrgBenchmarkResponse)
async def get_org_benchmark(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if str(current_user.organization_id) != org_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    stmt = select(Organization).where(Organization.id == org_id)
    org = (await db.execute(stmt)).scalars().first()
    if not org or not org.sector:
        return OrgBenchmarkResponse(is_available=False)

    stmt_snap = select(ScoreSnapshot).where(ScoreSnapshot.organization_id == org_id).order_by(ScoreSnapshot.date.desc()).limit(1)
    snap = (await db.execute(stmt_snap)).scalars().first()
    org_score = snap.score_global if snap else None
    
    if org_score is None:
        return OrgBenchmarkResponse(is_available=False, sector=org.sector)

    stmt_bench = select(SectorBenchmarkAggregate).where(
        SectorBenchmarkAggregate.sector == org.sector,
        SectorBenchmarkAggregate.metric_type == "score_global"
    ).order_by(SectorBenchmarkAggregate.computed_at.desc()).limit(1)
    
    bench = (await db.execute(stmt_bench)).scalars().first()
    
    if not bench:
        return OrgBenchmarkResponse(is_available=False, sector=org.sector, org_score=org_score)
        
    if org_score >= bench.percentile_75:
        position = "Top 25%"
    elif org_score >= bench.percentile_50:
        position = "Top 50%"
    elif org_score >= bench.percentile_25:
        position = "Top 75%"
    else:
        position = "Bottom 25%"

    return OrgBenchmarkResponse(
        is_available=True,
        sector=org.sector,
        org_score=org_score,
        percentile_25=bench.percentile_25,
        percentile_50=bench.percentile_50,
        percentile_75=bench.percentile_75,
        position_text=position
    )
