from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User, UserRole
from app.models.organization import Organization
from app.schemas.organization import OrganizationResponse, OrganizationUpdate
from app.dependencies import get_current_user, require_role
from app.modules.monitoring.scoring import compute_score

router = APIRouter()

@router.get("/me", response_model=OrganizationResponse)
async def get_my_organization(current_user: User = Depends(require_role(UserRole.readonly)), db: AsyncSession = Depends(get_db)):
    stmt = select(Organization).where(Organization.id == current_user.organization_id)
    result = await db.execute(stmt)
    return result.scalar_one()

@router.put("/me", response_model=OrganizationResponse)
async def update_my_organization(
    update_data: OrganizationUpdate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Organization).where(Organization.id == current_user.organization_id)
    result = await db.execute(stmt)
    org = result.scalar_one()

    update_dict = update_data.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(org, k, v)
        
    await db.commit()
    await db.refresh(org)
    return org

@router.get("/me/score")
async def get_my_organization_score(
    current_user: User = Depends(require_role(UserRole.readonly)), 
    db: AsyncSession = Depends(get_db)
):
    return await compute_score(db, current_user.organization_id)

@router.get("/me/score/history")
async def get_my_organization_score_history(
    days: int = 30,
    current_user: User = Depends(require_role(UserRole.readonly)), 
    db: AsyncSession = Depends(get_db)
):
    from datetime import date, timedelta
    from app.models.score_snapshot import ScoreSnapshot
    
    cutoff_date = date.today() - timedelta(days=days)
    
    stmt = (
        select(ScoreSnapshot)
        .where(
            ScoreSnapshot.organization_id == current_user.organization_id,
            ScoreSnapshot.date >= cutoff_date
        )
        .order_by(ScoreSnapshot.date.asc())
    )
    result = await db.execute(stmt)
    snapshots = result.scalars().all()
    
    return [
        {
            "date": s.date.isoformat(),
            "score_global": s.score_global,
            "categories": {
                "dns": s.score_dns,
                "tls": s.score_tls,
                "messagerie": s.score_messagerie,
                "services": s.score_services,
                "configuration": s.score_configuration
            }
        }
        for s in snapshots
    ]

@router.get("/me/dashboard/stats")
async def get_dashboard_stats(
    current_user: User = Depends(require_role(UserRole.readonly)), 
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import func, case
    from app.models.asset import Asset, AssetStatus
    from app.models.risk import Risk, RiskStatus
    from app.models.domain import Domain
    from app.models.check import Check
    
    org_id = current_user.organization_id
    
    # 1. Active Assets
    stmt = select(func.count(Asset.id)).where(Asset.organization_id == org_id, Asset.status == AssetStatus.active)
    active_assets = (await db.execute(stmt)).scalar() or 0
    
    # 2. Risks (Total and Critical)
    stmt = select(
        func.count(Risk.id).label('total'),
        func.sum(case((Risk.severity == 'critical', 1), else_=0)).label('critical')
    ).where(Risk.organization_id == org_id, Risk.status == RiskStatus.open)
    res = (await db.execute(stmt)).first()
    open_risks_total = res.total or 0
    open_risks_critical = res.critical or 0
    
    # 3. Recent Changes (checks with changed_from_previous != unchanged)
    stmt = (
        select(Check, Asset.hostname, Asset.ip_address)
        .join(Asset, Check.asset_id == Asset.id)
        .where(
            Check.organization_id == org_id,
            Check.changed_from_previous.in_(["new", "degraded", "improved"])
        )
        .order_by(Check.executed_at.desc())
        .limit(8)
    )
    changes_res = (await db.execute(stmt)).all()
    recent_changes = []
    for check, hostname, ip in changes_res:
        recent_changes.append({
            "id": str(check.id),
            "type": check.type,
            "result": check.result,
            "changed_from_previous": check.changed_from_previous,
            "executed_at": check.executed_at.isoformat(),
            "target": hostname or ip or "Unknown"
        })
        
    # 4. Last Analyses per domain
    stmt = select(Domain.id, Domain.name, Domain.last_discovery_at).where(Domain.organization_id == org_id)
    domains_res = (await db.execute(stmt)).all()
    
    last_analyses = []
    for d_id, d_name, d_disc in domains_res:
        # find max executed_at from checks of this domain's assets
        stmt_check = (
            select(func.max(Check.executed_at))
            .select_from(Asset)
            .join(Check, Asset.id == Check.asset_id)
            .where(Asset.domain_id == d_id)
        )
        last_mon = (await db.execute(stmt_check)).scalar()
        last_analyses.append({
            "domain": d_name,
            "last_discovery": d_disc.isoformat() if d_disc else None,
            "last_monitoring": last_mon.isoformat() if last_mon else None
        })
        
    return {
        "active_assets": active_assets,
        "open_risks_total": open_risks_total,
        "open_risks_critical": open_risks_critical,
        "recent_changes": recent_changes,
        "last_analyses": last_analyses
    }


@router.get("/me/financial-exposure")
async def get_financial_exposure(
    current_user: User = Depends(require_role(UserRole.readonly)), 
    db: AsyncSession = Depends(get_db)
):
    from app.models.risk import Risk, RiskStatus
    import json
    import os
    
    RISK_RULES_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "risk_rules_content.json")
    try:
        with open(RISK_RULES_PATH, "r", encoding="utf-8") as f:
            rules = json.load(f)
    except:
        rules = {}
        
    stmt = select(Risk).where(Risk.organization_id == current_user.organization_id, Risk.status == RiskStatus.open)
    risks = (await db.execute(stmt)).scalars().all()
    
    total_min = 0.0
    total_max = 0.0
    
    risk_exposures = []
    
    for r in risks:
        rule = rules.get(r.rule_key, {})
        freq = rule.get("frequency_estimate", 0)
        low = rule.get("loss_magnitude_low", 0)
        high = rule.get("loss_magnitude_high", 0)
        
        r_min = low * freq
        r_max = high * freq
        
        total_min += r_min
        total_max += r_max
        
        severity = rule.get("default_severity", "medium")
        if severity == "critical":
            effort = "élevé"
        elif severity == "high":
            effort = "moyen"
        else:
            effort = "faible"
            
        if r.rule_key in ["admin_port_exposed", "mail_port_exposed_without_tls", "dns_zone_transfer_exposed"]:
            effort = "faible"
            
        risk_exposures.append({
            "id": str(r.id),
            "title": rule.get("title", r.rule_key),
            "reduction_amount": r_max,
            "effort": effort
        })
        
    risk_exposures.sort(key=lambda x: x["reduction_amount"], reverse=True)
    top_risks = risk_exposures[:3]
        
    return {
        "annualized_loss_min": total_min,
        "annualized_loss_max": total_max,
        "currency": "MAD",
        "top_risks": top_risks,
        "warning": "Estimation indicative basée sur des références sectorielles publiques, destinée à faciliter la priorisation budgétaire, ne constitue pas une évaluation actuarielle ou d'assurance"
    }

@router.get("/me/vendors")
async def get_my_vendors(
    current_user: User = Depends(require_role(UserRole.readonly)), 
    db: AsyncSession = Depends(get_db)
):
    from app.models.domain import Domain
    stmt = select(Domain).where(Domain.organization_id == current_user.organization_id, Domain.relationship == 'vendor')
    vendors = (await db.execute(stmt)).scalars().all()
    
    res = []
    for v in vendors:
        score = await compute_score(db, current_user.organization_id, v.id)
        res.append({
            "id": str(v.id),
            "name": v.name,
            "score": score
        })
    return res

@router.get("/me/dashboard/bec-risk")
async def get_bec_risk_score(
    current_user: User = Depends(require_role(UserRole.readonly)), 
    db: AsyncSession = Depends(get_db)
):
    from app.models.risk import Risk, RiskStatus
    from app.models.threat_intel import ThreatIntelFinding
    from sqlalchemy import func
    
    org_id = current_user.organization_id
    
    stmt = select(func.count(Risk.id)).where(
        Risk.organization_id == org_id,
        Risk.status == RiskStatus.open,
        Risk.rule_key.in_(["spf_missing", "dmarc_missing", "dmarc_policy_none"])
    )
    email_risks_count = (await db.execute(stmt)).scalar() or 0
    
    stmt = select(ThreatIntelFinding).where(
        ThreatIntelFinding.organization_id == org_id,
        ThreatIntelFinding.finding_type == 'typosquatting'
    )
    typo_findings = (await db.execute(stmt)).scalars().all()
    active_typo_domains = 0
    for f in typo_findings:
        if f.raw_data and f.raw_data.get('has_mx') is True:
            active_typo_domains += 1
            
    stmt = select(func.count(ThreatIntelFinding.id)).where(
        ThreatIntelFinding.organization_id == org_id,
        ThreatIntelFinding.finding_type == 'credential_leak'
    )
    credential_leaks_count = (await db.execute(stmt)).scalar() or 0
    
    score_value = 0
    if email_risks_count > 0: score_value += 1
    if active_typo_domains > 0: score_value += 2
    if credential_leaks_count > 0: score_value += 1
        
    severity = "Faible"
    explanation = "Votre surface d'attaque email est globalement bien maîtrisée. Maintenez vos politiques strictes."
    
    if score_value == 1:
        severity = "Moyen"
        explanation = "Quelques faiblesses identifiées (fuites d'identifiants ou protection email perfectible). Un attaquant pourrait tenter de s'introduire ou d'usurper votre identité."
    elif score_value == 2:
        severity = "Élevé"
        explanation = "Un domaine similaire au vôtre est actif et capable d'envoyer des emails. Surveillez activement les tentatives d'usurpation de marque."
    elif score_value >= 3:
        severity = "Critique"
        if active_typo_domains > 0 and email_risks_count > 0:
            explanation = "Votre politique DMARC permissive combinée à un domaine quasi-identique actif avec serveur mail configuré représente un risque critique de fraude par usurpation d'identité de dirigeant (Fraude au président)."
        else:
            explanation = "Combinaison dangereuse de fuites d'identifiants et de faiblesses de protection email. Risque critique de compromission Business Email Compromise (BEC)."
            
    return {
        "severity": severity,
        "explanation": explanation,
        "signals": {
            "email_protection_risks": email_risks_count,
            "active_typo_domains": active_typo_domains,
            "credential_leaks": credential_leaks_count
        }
    }

@router.get("/{org_id}/asset-graph")
async def get_organization_asset_graph(
    org_id: str,
    min_confidence: float = 0.0,
    relation_types: str | None = None,
    current_user: User = Depends(require_role(UserRole.readonly)),
    db: AsyncSession = Depends(get_db)
):
    import uuid
    from sqlalchemy import select
    from app.models.asset import Asset, AssetStatus
    from app.models.risk import Risk, RiskStatus
    from app.models.asset_relation import AssetRelation
    from app.models.attack_scenario import AttackScenarioDetected
    from fastapi import HTTPException
    
    if str(current_user.organization_id) != org_id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    try:
        org_uuid = uuid.UUID(org_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid organization ID format")
        
    # Get Assets limit 501
    stmt_assets = select(Asset).where(
        Asset.organization_id == org_uuid,
        Asset.status != AssetStatus.inactive
    ).limit(501)
    
    assets_res = (await db.execute(stmt_assets)).scalars().all()
    if len(assets_res) > 500:
        raise HTTPException(status_code=400, detail="Le graphe contient plus de 500 nœuds. Veuillez filtrer pour éviter un plantage du navigateur.")
        
    asset_ids = [a.id for a in assets_res]
    if not asset_ids:
        return {"nodes": [], "edges": [], "meta": {"total_nodes": 0, "total_edges": 0, "last_inferred": None}}
        
    # Get open risks for these assets
    stmt_risks = select(Risk.asset_id, Risk.severity).where(
        Risk.asset_id.in_(asset_ids),
        Risk.status == RiskStatus.open
    )
    risks_res = (await db.execute(stmt_risks)).all()
    
    asset_risks = {a_id: [] for a_id in asset_ids}
    for r_ast_id, r_sev in risks_res:
        asset_risks[r_ast_id].append(r_sev)
        
    severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    def get_max_severity(sevs):
        if not sevs: return None
        return max(sevs, key=lambda s: severity_order.get(s, 0))
        
    # Get active scenarios to mark assets and return paths
    stmt_scen = select(AttackScenarioDetected.id, AttackScenarioDetected.attack_path).where(
        AttackScenarioDetected.organization_id == org_uuid,
        AttackScenarioDetected.status.in_(["open", "partial"])
    )
    scen_res = (await db.execute(stmt_scen)).all()
    active_asset_ids = set()
    active_paths = []
    for s_id, path in scen_res:
        if path:
            active_paths.append({
                "scenario_id": str(s_id),
                "path": path
            })
            for step in path:
                if isinstance(step, dict) and 'asset_id' in step and step['asset_id']:
                    try:
                        active_asset_ids.add(uuid.UUID(step['asset_id']))
                    except:
                        pass
                        
    # Build nodes
    nodes = []
    for a in assets_res:
        sevs = asset_risks[a.id]
        nodes.append({
            "id": str(a.id),
            "name": a.hostname or a.ip_address or str(a.id),
            "type": a.type,
            "criticality": a.criticality,
            "open_risks_count": len(sevs),
            "max_severity": get_max_severity(sevs),
            "is_in_active_scenario": a.id in active_asset_ids
        })
        
    # Get edges
    stmt_edges = select(AssetRelation).where(
        AssetRelation.source_asset_id.in_(asset_ids),
        AssetRelation.target_asset_id.in_(asset_ids),
        AssetRelation.confidence >= min_confidence
    )
    
    if relation_types:
        r_types = [r.strip() for r in relation_types.split(",")]
        stmt_edges = stmt_edges.where(AssetRelation.relation_type.in_(r_types))
        
    edges_res = (await db.execute(stmt_edges)).scalars().all()
    
    edges = []
    last_detected = None
    for e in edges_res:
        edges.append({
            "source": str(e.source_asset_id),
            "target": str(e.target_asset_id),
            "relation_type": e.relation_type,
            "confidence": e.confidence,
            "evidence": e.evidence
        })
        if not last_detected or e.detected_at > last_detected:
            last_detected = e.detected_at
            
    return {
        "nodes": nodes,
        "edges": edges,
        "active_paths": active_paths,
        "meta": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "last_inferred": last_detected.isoformat() if last_detected else None
        }
    }
