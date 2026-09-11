import json
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.risk import Risk
from app.models.attack_scenario import AttackScenarioDetected
from app.dependencies import get_current_user
from app.models.asset import Asset
from app.schemas.scenario import AttackScenarioResponse, ScenarioRiskDetail, ScenarioPathResponse, ScenarioPathNode, ScenarioPathEdge, ScenarioPathMeta
from app.modules.monitoring.scenario_engine import load_attack_scenarios
from app.api.mitre import load_risk_rules

router = APIRouter()

@router.get("/organizations/{org_id}/scenarios", response_model=List[AttackScenarioResponse])
async def get_organization_scenarios(
    org_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if str(current_user.organization_id) != org_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    scenarios_def = load_attack_scenarios()
    
    stmt = select(AttackScenarioDetected).where(
        AttackScenarioDetected.organization_id == org_id,
        AttackScenarioDetected.status.in_(["open", "partial"])
    )
    result = await db.execute(stmt)
    active_scenarios = result.scalars().all()
    
    # We need the asset names for the risks
    if not active_scenarios:
        return []
        
    all_risk_ids = []
    for s in active_scenarios:
        all_risk_ids.extend([uuid.UUID(r_id) for r_id in s.risk_ids])
        
    stmt_risks = select(Risk).where(Risk.id.in_(all_risk_ids)).options(selectinload(Risk.asset))
    result_risks = await db.execute(stmt_risks)
    risks_objs = {r.id: r for r in result_risks.scalars().all()}
    
    responses = []
    for s in active_scenarios:
        s_def = scenarios_def.get(s.scenario_key, {})
        title = s_def.get("title", s.scenario_key)
        severity = s_def.get("severity", "critical")
        explanation = s_def.get("explanation", "")
        
        risks_details = []
        for r_id_str in s.risk_ids:
            r_id = uuid.UUID(r_id_str)
            if r_id in risks_objs:
                r_obj = risks_objs[r_id]
                asset_name = r_obj.asset.hostname or r_obj.asset.ip_address if r_obj.asset else None
                
                # Fetch techniques from risk rules
                rule_def = load_risk_rules().get(r_obj.rule_key, {})
                techniques = rule_def.get("attack_techniques", [])
                
                risks_details.append(ScenarioRiskDetail(
                    id=r_id,
                    rule_key=r_obj.rule_key,
                    asset_target=asset_name,
                    attack_techniques=techniques
                ))
                
        responses.append(AttackScenarioResponse(
            id=s.id,
            scenario_key=s.scenario_key,
            title=title,
            severity=severity,
            explanation=explanation,
            status=s.status,
            created_at=s.created_at,
            risks=risks_details,
            severity_score=s.severity_score or 0,
            likelihood_score=s.likelihood_score or 0
        ))
        
    return responses

@router.post("/organizations/{org_id}/scenarios/trigger")
async def trigger_scenarios(
    org_id: str,
    current_user: User = Depends(get_current_user)
):
    """Admin/Debug route to trigger evaluation"""
    if str(current_user.organization_id) != org_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    from app.modules.monitoring.tasks import evaluate_attack_scenarios_task
    evaluate_attack_scenarios_task.delay(org_id)
    return {"status": "triggered"}

@router.get("/scenarios/{scenario_id}/path", response_model=ScenarioPathResponse)
async def get_scenario_path(
    scenario_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch scenario
    stmt = select(AttackScenarioDetected).where(AttackScenarioDetected.id == scenario_id)
    scenario = await db.scalar(stmt)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
        
    if scenario.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    path_data = scenario.attack_path or []
    
    # We need to fetch asset names for all assets in the path
    asset_ids = list(set([item["asset_id"] for item in path_data]))
    stmt_assets = select(Asset).where(Asset.id.in_([uuid.UUID(aid) for aid in asset_ids]))
    assets = (await db.execute(stmt_assets)).scalars().all()
    assets_map = {str(a.id): (a.hostname or a.ip_address or "Unknown", a.type.value if hasattr(a.type, "value") else a.type) for a in assets}
    
    # Also fetch risks for the rule_keys
    risk_ids = list(set([item["risk_id"] for item in path_data]))
    stmt_risks = select(Risk).where(Risk.id.in_([uuid.UUID(rid) for rid in risk_ids]))
    risks = (await db.execute(stmt_risks)).scalars().all()
    risks_map = {str(r.id): r.rule_key for r in risks}
    
    nodes = []
    edges = []
    added_nodes = set()
    
    for i, item in enumerate(path_data):
        stage = item.get("stage", i+1)
        asset_id = item.get("asset_id")
        tech_id = item.get("technique_id")
        risk_id = item.get("risk_id")
        
        if not asset_id:
            continue
            
        # Add asset node
        if asset_id not in added_nodes:
            aname, atype = assets_map.get(asset_id, ("Unknown", "asset"))
            nodes.append(ScenarioPathNode(id=asset_id, name=aname, type=atype))
            added_nodes.add(asset_id)
            
        # Add technique node (unique per stage to avoid merging if same technique used repeatedly)
        tech_node_id = f"tech_{stage}_{tech_id}"
        if tech_node_id not in added_nodes:
            nodes.append(ScenarioPathNode(id=tech_node_id, name=tech_id or f"Stage {stage}", type="technique"))
            added_nodes.add(tech_node_id)
            
        rule_key = risks_map.get(risk_id)
        
        # Connect Asset -> Technique
        edges.append(ScenarioPathEdge(source=asset_id, target=tech_node_id, rule_key=rule_key, stage=stage))
        
        # Connect Technique -> Next Asset (if there is a next step)
        if i < len(path_data) - 1:
            next_asset_id = path_data[i+1].get("asset_id")
            if next_asset_id:
                edges.append(ScenarioPathEdge(source=tech_node_id, target=next_asset_id, rule_key=None, stage=stage))
            
    meta = ScenarioPathMeta(
        likelihood_score=scenario.likelihood_score or 0,
        severity_score=scenario.severity_score or 0,
        kill_chain_stage_reached=scenario.kill_chain_stage_reached or 0,
        kill_chain_total_stages=scenario.kill_chain_total_stages or 0,
        relevant_attack_groups=scenario.relevant_attack_groups or []
    )
    
    return ScenarioPathResponse(nodes=nodes, edges=edges, meta=meta)
