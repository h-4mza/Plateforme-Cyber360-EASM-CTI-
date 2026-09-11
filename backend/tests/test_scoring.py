import pytest
import uuid
import json
from unittest.mock import AsyncMock, patch, MagicMock

from app.modules.monitoring.scoring import compute_score
from app.models.risk import Risk, RiskStatus, RiskSeverity

def build_mock_risk(rule_key, severity):
    risk = MagicMock(spec=Risk)
    risk.rule_key = rule_key
    risk.severity = severity
    risk.status = RiskStatus.open
    return risk

@pytest.fixture
def mock_session():
    return AsyncMock()

@pytest.fixture
def mock_configs(monkeypatch):
    monkeypatch.setattr("app.modules.monitoring.scoring.load_scoring_config", lambda: {
        "penalties": {"critical": 25, "high": 15, "medium": 8, "low": 3},
        "category_weights": {"dns": 1.0, "tls": 1.0, "messagerie": 1.0, "services": 1.0, "configuration": 1.0}
    })
    monkeypatch.setattr("app.modules.monitoring.scoring.load_risk_rules", lambda: {
        "dns_rule": {"category": "dns"},
        "tls_rule": {"category": "tls"},
        "msg_rule": {"category": "messagerie"},
        "srv_rule": {"category": "services"},
        "cfg_rule": {"category": "configuration"},
        "unknown_rule": {"category": "unknown_cat"},
        "threat_intel_rule": {"category": "threat_intelligence"}
    })

def test_compute_score_no_assets(mock_session):
    org_id = uuid.uuid4()
    mock_session.scalar.side_effect = [0, 0]
    
    import asyncio
    result = asyncio.run(compute_score(mock_session, org_id))
    
    assert result["is_available"] is False
    assert result["global_score"] is None
    assert "Score non disponible" in result["message"]

def test_compute_score_no_checks(mock_session):
    org_id = uuid.uuid4()
    mock_session.scalar.side_effect = [5, 0]
    
    import asyncio
    result = asyncio.run(compute_score(mock_session, org_id))
    
    assert result["is_available"] is False
    assert result["global_score"] is None

def test_compute_score_perfect(mock_session, mock_configs):
    org_id = uuid.uuid4()
    mock_session.scalar.side_effect = [5, 10]
    
    mock_result = MagicMock()
    mock_result.scalars().all.return_value = []
    mock_session.execute.return_value = mock_result
    
    import asyncio
    result = asyncio.run(compute_score(mock_session, org_id))
    
    assert result["is_available"] is True
    assert result["global_score"] == 100
    for cat in result["categories"]:
        assert cat["score"] == 100

def test_compute_score_with_penalties(mock_session, mock_configs):
    org_id = uuid.uuid4()
    mock_session.scalar.side_effect = [5, 10]
    
    risks = [
        build_mock_risk("tls_rule", RiskSeverity.critical), 
        build_mock_risk("msg_rule", RiskSeverity.high),     
        build_mock_risk("msg_rule", RiskSeverity.medium),   
        build_mock_risk("unknown_rule", RiskSeverity.low)   
    ]
    mock_result = MagicMock()
    mock_result.scalars().all.return_value = risks
    mock_session.execute.return_value = mock_result
    
    import asyncio
    result = asyncio.run(compute_score(mock_session, org_id))
    
    assert result["is_available"] is True
    
    cats = {c["category"]: c["score"] for c in result["categories"]}
    assert cats["tls"] == 75       
    assert cats["messagerie"] == 77 
    assert cats["dns"] == 100
    assert cats["services"] == 100
    assert cats["configuration"] == 100
    assert cats["unknown_cat"] == 97
    
    assert result["global_score"] == 93

def test_compute_score_clamped_at_zero(mock_session, mock_configs):
    org_id = uuid.uuid4()
    mock_session.scalar.side_effect = [5, 10]
    
    risks = [build_mock_risk("dns_rule", RiskSeverity.critical) for _ in range(5)]
    
    mock_result = MagicMock()
    mock_result.scalars().all.return_value = risks
    mock_session.execute.return_value = mock_result
    
    import asyncio
    result = asyncio.run(compute_score(mock_session, org_id))
    
    assert result["is_available"] is True
    cats = {c["category"]: c["score"] for c in result["categories"]}
    assert cats["dns"] == 0 
    
    assert result["global_score"] == 86

def test_dynamic_category_scoring(mock_session, mock_configs):
    org_id = uuid.uuid4()
    mock_session.scalar.side_effect = [5, 10]
    
    # We trigger a risk that belongs to the dynamically added 'threat_intelligence' category
    risks = [
        build_mock_risk("threat_intel_rule", RiskSeverity.high),
        build_mock_risk("threat_intel_rule", RiskSeverity.medium)
    ]
    
    mock_result = MagicMock()
    mock_result.scalars().all.return_value = risks
    mock_session.execute.return_value = mock_result
    
    import asyncio
    result = asyncio.run(compute_score(mock_session, org_id))
    
    assert result["is_available"] is True
    cats = {c["category"]: c["score"] for c in result["categories"]}
    
    # It should correctly calculate the dynamic category
    assert "threat_intelligence" in cats
    # 100 - (15 + 8) = 77
    assert cats["threat_intelligence"] == 77
    
    # Check that other standard categories are initialized to 100
    assert cats["dns"] == 100
    assert cats["tls"] == 100
    
    # Global score uses the new dynamic category as well (weight = 1.0 by default)
    # Total sum = 100 (dns) + 100 (tls) + 100 (msg) + 100 (srv) + 100 (cfg) + 77 (ti) + 100 (unknown)
    # Total categories = 7, average = 677 / 7 = 96.71 -> 97
    assert result["global_score"] == 97
