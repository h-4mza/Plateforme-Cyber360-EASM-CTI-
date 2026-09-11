from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from typing import Dict, Any, List

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.risk import Risk, RiskStatus, risk_technique_map
from app.models.attack import (
    AttackTactic, AttackTechnique, AttackGroup, AttackSoftware, AttackMitigation,
    attack_technique_tactics
)
from app.models.asset import Asset
from app.models.domain import Domain
from app.tasks.attack_tasks import sync_mitre_attack
from app.schemas.attack import (
    AttackMatrixResponse, MatrixTactic, MatrixTechnique,
    TechniqueDetailResponse, TechniqueRiskDetail, MitreMitigation, MitreGroup,
    GroupDetailResponse, MitreSoftware, MitreTechniqueBase, AttackCoverageResponse
)

router = APIRouter()

def severity_to_level(sev: str) -> int:
    mapping = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    return mapping.get(sev, 0)

def level_to_severity(level: int) -> str:
    mapping = {1: "low", 2: "medium", 3: "high", 4: "critical"}
    return mapping.get(level, "none")

@router.post("/sync", summary="Trigger manual MITRE ATT&CK sync")
async def trigger_sync(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    sync_mitre_attack.delay()
    return {"message": "MITRE ATT&CK sync started in background"}

async def get_domain_active_risks_techniques(db: AsyncSession, domain_id: str = None, organization_id: str = None):
    # Fetch active risks for a domain or org and their mapped techniques
    stmt = (
        select(risk_technique_map.c.technique_id, Risk.id, Risk.severity)
        .join(Risk, Risk.id == risk_technique_map.c.risk_id)
        .join(Asset, Asset.id == Risk.asset_id)
        .where(Risk.status == RiskStatus.open)
    )
    if domain_id:
        stmt = stmt.where(Asset.domain_id == domain_id)
    elif organization_id:
        stmt = stmt.where(Asset.organization_id == organization_id)
        
    result = await db.execute(stmt)
    rows = result.all()
    
    technique_stats = {}
    for tech_id, risk_id, severity in rows:
        if tech_id not in technique_stats:
            technique_stats[tech_id] = {"count": 0, "max_severity": 0}
        technique_stats[tech_id]["count"] += 1
        sev_val = severity.value if hasattr(severity, "value") else severity
        technique_stats[tech_id]["max_severity"] = max(technique_stats[tech_id]["max_severity"], severity_to_level(sev_val))
    
    return technique_stats

@router.get("/matrix", response_model=AttackMatrixResponse)
async def get_attack_matrix(domain_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify domain access
    domain = await db.scalar(select(Domain).where(Domain.id == domain_id, Domain.organization_id == current_user.organization_id))
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    tech_stats = await get_domain_active_risks_techniques(db, domain_id)
    
    tactics_stmt = select(AttackTactic).options(selectinload(AttackTactic.techniques)).order_by(AttackTactic.order.asc())
    tactics = (await db.execute(tactics_stmt)).scalars().all()
    
    result_tactics = []
    for tactic in tactics:
        matrix_techniques = []
        for tech in tactic.techniques:
            stats = tech_stats.get(tech.id, {"count": 0, "max_severity": 0})
            matrix_techniques.append(MatrixTechnique(
                id=tech.id,
                name=tech.name,
                is_subtechnique=tech.is_subtechnique,
                parent_technique_id=tech.parent_technique_id,
                description=tech.description,
                active_risks_count=stats["count"],
                exposure_level=level_to_severity(stats["max_severity"])
            ))
        result_tactics.append(MatrixTactic(
            id=tactic.id,
            name=tactic.name,
            short_name=tactic.short_name,
            techniques=matrix_techniques
        ))
        
    return AttackMatrixResponse(tactics=result_tactics)

@router.get("/technique/{technique_id}", response_model=TechniqueDetailResponse)
async def get_technique_detail(technique_id: str, domain_id: str = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if domain_id:
        domain = await db.scalar(select(Domain).where(Domain.id == domain_id, Domain.organization_id == current_user.organization_id))
        if not domain:
            raise HTTPException(status_code=404, detail="Domain not found")

    tech_stmt = select(AttackTechnique).options(
        selectinload(AttackTechnique.tactics),
        selectinload(AttackTechnique.mitigations),
        selectinload(AttackTechnique.groups)
    ).where(AttackTechnique.id == technique_id)
    technique = await db.scalar(tech_stmt)
    if not technique:
        raise HTTPException(status_code=404, detail="Technique not found")
        
    risks_stmt = (
        select(Risk, func.coalesce(Asset.hostname, Asset.ip_address).label("asset_name"))
        .join(Asset, Asset.id == Risk.asset_id)
        .join(risk_technique_map, risk_technique_map.c.risk_id == Risk.id)
        .where(risk_technique_map.c.technique_id == technique_id)
        .where(Risk.status == RiskStatus.open)
    )
    
    if domain_id:
        risks_stmt = risks_stmt.where(Asset.domain_id == domain_id)
    else:
        risks_stmt = risks_stmt.where(Asset.organization_id == current_user.organization_id)
        
    risks_rows = (await db.execute(risks_stmt)).all()
    
    active_risks = []
    for risk, asset_name in risks_rows:
        active_risks.append(TechniqueRiskDetail(
            id=str(risk.id),
            rule_key=risk.rule_key,
            severity=risk.severity.value if hasattr(risk.severity, "value") else risk.severity,
            asset_name=asset_name,
            first_detected_at=risk.first_detected_at
        ))
        
    return TechniqueDetailResponse(
        id=technique.id,
        name=technique.name,
        is_subtechnique=technique.is_subtechnique,
        parent_technique_id=technique.parent_technique_id,
        description=technique.description,
        tactics=[t.name for t in technique.tactics],
        mitigations=[MitreMitigation.model_validate(m) for m in technique.mitigations],
        groups=[MitreGroup.model_validate(g) for g in technique.groups],
        active_risks=active_risks
    )

def compute_group_exposure(group_techniques: List[str], tech_stats: Dict[str, dict]) -> dict:
    matched_techs = [t for t in group_techniques if t in tech_stats and tech_stats[t]["count"] > 0]
    if not matched_techs:
        return {"level": "none", "matching_techniques_count": 0, "score": 0}
        
    max_sev = max([tech_stats[t]["max_severity"] for t in matched_techs])
    return {
        "level": level_to_severity(max_sev),
        "matching_techniques_count": len(matched_techs),
        "score": len(matched_techs) * max_sev
    }

@router.get("/group/{group_id}", response_model=GroupDetailResponse)
async def get_group_detail(group_id: str, domain_id: str = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if domain_id:
        domain = await db.scalar(select(Domain).where(Domain.id == domain_id, Domain.organization_id == current_user.organization_id))
        if not domain:
            raise HTTPException(status_code=404, detail="Domain not found")

    group_stmt = select(AttackGroup).options(
        selectinload(AttackGroup.techniques),
        selectinload(AttackGroup.software)
    ).where(AttackGroup.id == group_id)
    group = await db.scalar(group_stmt)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    tech_stats = await get_domain_active_risks_techniques(db, domain_id=domain_id, organization_id=str(current_user.organization_id))
    group_tech_ids = [t.id for t in group.techniques]
    
    exposure = compute_group_exposure(group_tech_ids, tech_stats)
    
    return GroupDetailResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        techniques=[MitreTechniqueBase.model_validate(t) for t in group.techniques],
        software=[MitreSoftware.model_validate(s) for s in group.software],
        exposure_score=exposure
    )

@router.get("/coverage/{domain_id}", response_model=AttackCoverageResponse)
async def get_attack_coverage(domain_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    domain = await db.scalar(select(Domain).where(Domain.id == domain_id, Domain.organization_id == current_user.organization_id))
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    tech_stats = await get_domain_active_risks_techniques(db, domain_id)
    
    tactics = (await db.execute(select(AttackTactic).options(selectinload(AttackTactic.techniques)))).scalars().all()
    total_techniques = await db.scalar(select(func.count(AttackTechnique.id)))
    
    covered_tactics = 0
    top_techniques_raw = []
    
    for tactic in tactics:
        tactic_covered = False
        for tech in tactic.techniques:
            if tech.id in tech_stats and tech_stats[tech.id]["count"] > 0:
                tactic_covered = True
                stats = tech_stats[tech.id]
                top_techniques_raw.append({
                    "tech": tech,
                    "count": stats["count"],
                    "sev_level": stats["max_severity"]
                })
        if tactic_covered:
            covered_tactics += 1
            
    exposed_techniques_count = len(tech_stats.keys())
    matrix_exposed_percentage = (exposed_techniques_count / total_techniques * 100) if total_techniques > 0 else 0
    
    top_techniques_raw.sort(key=lambda x: (x["sev_level"], x["count"]), reverse=True)
    top_techniques = []
    # Deduplicate for top 5
    seen_techs = set()
    for item in top_techniques_raw:
        if item["tech"].id not in seen_techs:
            top_techniques.append(MatrixTechnique(
                id=item["tech"].id,
                name=item["tech"].name,
                is_subtechnique=item["tech"].is_subtechnique,
                parent_technique_id=item["tech"].parent_technique_id,
                description=item["tech"].description,
                active_risks_count=item["count"],
                exposure_level=level_to_severity(item["sev_level"])
            ))
            seen_techs.add(item["tech"].id)
            if len(top_techniques) >= 5:
                break
                
    groups = (await db.execute(select(AttackGroup).options(selectinload(AttackGroup.techniques)))).scalars().all()
    group_exposures = []
    for g in groups:
        g_techs = [t.id for t in g.techniques]
        exp = compute_group_exposure(g_techs, tech_stats)
        if exp["score"] > 0:
            group_exposures.append({
                "group": MitreGroup.model_validate(g).model_dump(),
                "exposure": exp
            })
            
    group_exposures.sort(key=lambda x: x["exposure"]["score"], reverse=True)
    top_groups = group_exposures[:3]
    
    return AttackCoverageResponse(
        covered_tactics_count=covered_tactics,
        total_tactics=len(tactics),
        matrix_exposed_percentage=matrix_exposed_percentage,
        top_techniques=top_techniques,
        top_groups=top_groups
    )
