import pytest
import uuid
import json
from datetime import datetime, timezone, timedelta
from typing import List

from sqlalchemy import select

from app.models.asset import Asset
from app.models.risk import Risk
from app.models.asset_relation import AssetRelation, AssetRelationType
from app.models.attack_scenario import AttackScenarioDetected
from app.services.asset_relation_inference import calculate_aggregated_confidence
from app.modules.monitoring.scenario_engine import calculate_scenario_scores, evaluate_organization_scenarios, load_attack_scenarios


# 1. Test asset_relation_inference
def test_calculate_aggregated_confidence():
    # Single signal 0.9 -> expected 0.9
    assert abs(calculate_aggregated_confidence([0.9]) - 0.9) < 0.001
    
    # Two signals: 0.3 and 0.4 -> 1 - ((1-0.3) * (1-0.4)) = 1 - (0.7 * 0.6) = 0.58
    assert abs(calculate_aggregated_confidence([0.3, 0.4]) - 0.58) < 0.001

    # Three signals: 0.5, 0.5, 0.5 -> 1 - 0.125 = 0.875
    assert abs(calculate_aggregated_confidence([0.5, 0.5, 0.5]) - 0.875) < 0.001

    # Empty -> 0.0
    assert calculate_aggregated_confidence([]) == 0.0


# 2. Test Scoring calculations
def test_scenario_scores():
    # Setup mock risks
    class MockSeverity:
        value = "high"
        
    class MockRisk:
        def __init__(self, rid, created_at, severity):
            self.id = rid
            self.created_at = created_at
            self.severity = severity
    
    r1 = MockRisk("r1", datetime.now(timezone.utc), MockSeverity())
    # r2 is exactly 30 days old to hit the half-life
    r2 = MockRisk("r2", datetime.now(timezone.utc) - timedelta(days=30), MockSeverity())
    
    best_path = {
        "stages_completed": 2,
        "risk_ids": ["r1", "r2"],
        "path": [
            {"stage": 1, "risk_id": "r1", "asset_id": "a1", "technique_id": "T1"},
            {"stage": 2, "risk_id": "r2", "asset_id": "a2", "technique_id": "T2"}
        ]
    }
    
    total_stages = 2
    # Mock graph with relation a1 -> a2 having 0.5 confidence
    graph = {
        "a1": [("a2", "shared_ip", 0.5)]
    }
    
    sev, like, groups = calculate_scenario_scores(best_path, total_stages, [r1, r2], graph)
    
    # Severity for 'high' is 80. Both risks are 'high'.
    # Because of linear weighting, the weighted average of constants is still the constant.
    assert sev == 80
    
    # Likelihood breakdown:
    # - Completeness (40% weight): 2/2 stages = 100 -> 40 points
    # - Confidence (25% weight): edge a1->a2 is 0.5 = 50 -> 12.5 points
    # - Freshness (15% weight): oldest is 30 days, half-life is 30 days -> ~50 -> 7.5 points
    # - Threat Relevance (20% weight): 2 techniques -> 50 -> 10.0 points
    # Total roughly: 40 + 12.5 + 7.5 + 10.0 = 70.0
    assert 68 <= like <= 72


# 3. Test scenario_engine detection (integration)
@pytest.mark.asyncio
async def test_evaluate_organization_scenarios():
    from tests.conftest import engine, TestSessionLocal
    from app.models.base import Base
    import app.modules.monitoring.scenario_engine as se
    
    # Init DB schema
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    org_id = uuid.uuid4()
    domain_id = uuid.uuid4()
    
    async with TestSessionLocal() as db:
        # Create 2 Assets
        a1 = Asset(id=uuid.uuid4(), organization_id=org_id, domain_id=domain_id, ip_address="1.1.1.1", hostname="start.com", type="domain")
        a2 = Asset(id=uuid.uuid4(), organization_id=org_id, domain_id=domain_id, ip_address="2.2.2.2", hostname="end.com", type="domain")
        db.add_all([a1, a2])
        await db.commit()
        
        # Create relation a1 -> a2 (simulating shared_ip inference)
        rel = AssetRelation(
            source_asset_id=a1.id,
            target_asset_id=a2.id,
            relation_type=AssetRelationType.shared_ip,
            confidence=0.9,
            evidence={}
        )
        db.add(rel)
        await db.commit()
        
        # Mock load_attack_scenarios to provide our controlled test scenario
        original_load = se.load_attack_scenarios
        se.load_attack_scenarios = lambda: {
            "test_scenario": {
                "title": "Test 2 stages",
                "severity": "critical",
                "max_hops": 2,
                "allowed_relation_types": ["shared_ip"],
                "kill_chain": [
                    {"stage": 1, "rule_keys": ["test_rule_1"], "require_same_asset": False},
                    {"stage": 2, "rule_keys": ["test_rule_2"], "require_same_asset": False}
                ]
            }
        }
        
        try:
            # --- Test 1: No risks -> Absent ---
            await evaluate_organization_scenarios(org_id, db)
            stmt = select(AttackScenarioDetected).where(AttackScenarioDetected.scenario_key == "test_scenario")
            scenario_db = (await db.execute(stmt)).scalar_one_or_none()
            assert scenario_db is None
            
            # --- Test 2: Risk on step 1 -> Partial ---
            r1 = Risk(id=uuid.uuid4(), organization_id=org_id, asset_id=a1.id, rule_key="test_rule_1", status="open", severity="high")
            db.add(r1)
            await db.commit()
            
            await evaluate_organization_scenarios(org_id, db)
            scenario_db = (await db.execute(stmt)).scalar_one_or_none()
            
            assert scenario_db is not None
            assert scenario_db.status == "partial"
            assert scenario_db.kill_chain_stage_reached == 1
            
            # --- Test 3: Risk on step 2 via pivot -> Open ---
            r2 = Risk(id=uuid.uuid4(), organization_id=org_id, asset_id=a2.id, rule_key="test_rule_2", status="open", severity="critical")
            db.add(r2)
            await db.commit()
            
            await evaluate_organization_scenarios(org_id, db)
            scenario_db = (await db.execute(stmt)).scalar_one_or_none()
            
            assert scenario_db.status == "open"
            assert scenario_db.kill_chain_stage_reached == 2
            
        finally:
            # Restore original function
            se.load_attack_scenarios = original_load
            
    # Cleanup DB schema
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# 4. Test format migration / Non-regression
def test_scenario_format():
    """
    Vérifie qu'aucun scénario dans le fichier de production n'utilise l'ancien format 
    plat (initial_access_rules / execution_rules).
    Ils doivent tous avoir été migrés vers la liste 'kill_chain'.
    """
    scenarios = load_attack_scenarios()
    
    assert len(scenarios) > 0, "No scenarios loaded from JSON"
    
    for key, data in scenarios.items():
        assert "kill_chain" in data, f"Scenario '{key}' is missing 'kill_chain'. Migration failed or incomplete."
        assert isinstance(data["kill_chain"], list), f"'kill_chain' in '{key}' must be a list."
        assert len(data["kill_chain"]) >= 1, f"Kill chain in '{key}' is empty."
        
        for stage in data["kill_chain"]:
            assert "stage" in stage
            assert "rule_keys" in stage
            assert "require_same_asset" in stage

@pytest.mark.asyncio
async def test_typosquatting_integration():
    from tests.conftest import engine, TestSessionLocal
    from app.models.base import Base
    import app.modules.monitoring.scenario_engine as se
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    org_id = uuid.uuid4()
    domain_id = uuid.uuid4()
    
    async with TestSessionLocal() as db:
        # Create Root Domain Asset
        a_root = Asset(id=uuid.uuid4(), organization_id=org_id, domain_id=domain_id, hostname="legit.ma", type="root_domain")
        # Create Mail Subdomain Asset
        a_mail = Asset(id=uuid.uuid4(), organization_id=org_id, domain_id=domain_id, hostname="mail.legit.ma", type="subdomain")
        
        db.add_all([a_root, a_mail])
        await db.commit()
        
        # Create AssetRelation to allow pivot (same_root_domain is allowed by both scenarios)
        rel = AssetRelation(
            source_asset_id=a_mail.id,
            target_asset_id=a_root.id,
            relation_type=AssetRelationType.same_root_domain,
            confidence=1.0,
            evidence={}
        )
        db.add(rel)
        await db.commit()
        
        # 1. Satisfy Stage 1 of credible_phishing (spf_softfail) and maroc_starry_addax_spearphishing (dmarc_missing)
        r_spf = Risk(id=uuid.uuid4(), organization_id=org_id, asset_id=a_mail.id, rule_key="spf_softfail", status="open", severity="medium")
        r_dmarc = Risk(id=uuid.uuid4(), organization_id=org_id, asset_id=a_mail.id, rule_key="dmarc_missing", status="open", severity="high")
        db.add_all([r_spf, r_dmarc])
        await db.commit()
        
        # 2. Run engine, assert partial
        await se.evaluate_organization_scenarios(org_id, db)
        
        stmt_phishing = select(AttackScenarioDetected).where(AttackScenarioDetected.scenario_key == "credible_phishing")
        scenario_phish = (await db.execute(stmt_phishing)).scalar_one_or_none()
        assert scenario_phish is not None
        assert scenario_phish.status == "partial"
        assert scenario_phish.kill_chain_stage_reached == 1
        
        stmt_starry = select(AttackScenarioDetected).where(AttackScenarioDetected.scenario_key == "maroc_starry_addax_spearphishing")
        scenario_starry = (await db.execute(stmt_starry)).scalar_one_or_none()
        assert scenario_starry is not None
        assert scenario_starry.status == "partial"
        assert scenario_starry.kill_chain_stage_reached == 1
        
        # 3. Inject typosquatting_detected Risk on Root Domain
        r_typo = Risk(id=uuid.uuid4(), organization_id=org_id, asset_id=a_root.id, rule_key="typosquatting_detected", status="open", severity="high")
        db.add(r_typo)
        await db.commit()
        
        # 4. Run engine, assert open for both
        await se.evaluate_organization_scenarios(org_id, db)
        
        scenario_phish = (await db.execute(stmt_phishing)).scalar_one_or_none()
        assert scenario_phish.status == "open"
        assert scenario_phish.kill_chain_stage_reached == 2
        # Check severity recalculation is higher or present
        assert scenario_phish.severity_score > 0
        
        scenario_starry = (await db.execute(stmt_starry)).scalar_one_or_none()
        assert scenario_starry.status == "open"
        assert scenario_starry.kill_chain_stage_reached == 2

    # Cleanup DB schema
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
