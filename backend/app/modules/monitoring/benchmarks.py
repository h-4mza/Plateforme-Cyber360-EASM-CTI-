from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import uuid
import math

from app.models.organization import Organization
from app.models.score_snapshot import ScoreSnapshot
from app.models.sector_benchmark import SectorBenchmarkAggregate

def percentile(data, p):
    if not data: return 0.0
    s_data = sorted(data)
    k = (len(s_data) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(s_data) - 1)
    return s_data[f] + (k - f) * (s_data[c] - s_data[f])

async def compute_sector_benchmarks(db: AsyncSession):
    stmt = select(Organization)
    result = await db.execute(stmt)
    orgs = result.scalars().all()
    
    sector_orgs = {}
    for org in orgs:
        if not org.sector: continue
        if org.sector not in sector_orgs:
            sector_orgs[org.sector] = []
        sector_orgs[org.sector].append(org.id)
        
    now = datetime.now(timezone.utc)

    for sector, org_ids in sector_orgs.items():
        if len(org_ids) < 5:
            # STRICT RULE: Do not compute or expose benchmark if sample size < 5
            continue
            
        global_scores = []
        dns_scores = []
        tls_scores = []
        messagerie_scores = []
        services_scores = []
        
        for org_id in org_ids:
            stmt_snap = select(ScoreSnapshot).where(ScoreSnapshot.organization_id == org_id).order_by(ScoreSnapshot.date.desc()).limit(1)
            snap_res = await db.execute(stmt_snap)
            snap = snap_res.scalars().first()
            if snap:
                global_scores.append(snap.score_global)
                dns_scores.append(snap.score_dns)
                tls_scores.append(snap.score_tls)
                messagerie_scores.append(snap.score_messagerie)
                services_scores.append(snap.score_services)
                
        # Must still have >= 5 actual data points
        if len(global_scores) >= 5:
            metrics = {
                "score_global": global_scores,
                "score_dns": dns_scores,
                "score_tls": tls_scores,
                "score_messagerie": messagerie_scores,
                "score_services": services_scores
            }
            for m_type, m_data in metrics.items():
                p25 = percentile(m_data, 25)
                p50 = percentile(m_data, 50)
                p75 = percentile(m_data, 75)
                
                new_bench = SectorBenchmarkAggregate(
                    sector=sector,
                    metric_type=m_type,
                    percentile_25=p25,
                    percentile_50=p50,
                    percentile_75=p75,
                    sample_size=len(m_data),
                    computed_at=now
                )
                db.add(new_bench)
                
    await db.commit()
