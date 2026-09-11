import pytest
from app.api.compliance import compute_compliance
from app.models.risk import Risk
import uuid

def test_compute_compliance_all_states():
    # Mock data
    frameworks_data = {
        "test_fw": {
            "name": "Test Framework",
            "authority": "Test",
            "controls": [
                {
                    "control_id": "C-1",
                    "domain": "Tech",
                    "title": "Should be conforme",
                    "mapped_rule_keys": ["rule_conforme_1", "rule_conforme_2"]
                },
                {
                    "control_id": "C-2",
                    "domain": "Tech",
                    "title": "Should be non_conforme",
                    "mapped_rule_keys": ["rule_fail_1"]
                },
                {
                    "control_id": "C-3",
                    "domain": "Org",
                    "title": "Should be non_evaluable",
                    "mapped_rule_keys": []
                }
            ]
        }
    }
    
    risk_rules = {
        "rule_fail_1": {"title": "Test Fail Rule"}
    }
    
    # Create mock risk
    class MockAsset:
        name = "test.com"
        
    class MockRisk:
        id = uuid.uuid4()
        rule_key = "rule_fail_1"
        asset = MockAsset()
        
    open_risks = [MockRisk()]
    
    responses = compute_compliance("org_id", frameworks_data, open_risks, risk_rules)
    
    assert len(responses) == 1
    fw = responses[0]
    
    assert fw.evaluable_total == 2
    assert fw.non_evaluable_total == 1
    assert fw.compliant_total == 1
    assert fw.score == 50.0  # 1 / 2 * 100
    
    controls = {c.control_id: c for c in fw.controls}
    
    # C-1 should be conforme
    assert controls["C-1"].status == "conforme"
    assert controls["C-1"].open_risks_count == 0
    
    # C-2 should be non_conforme
    assert controls["C-2"].status == "non_conforme"
    assert controls["C-2"].open_risks_count == 1
    assert controls["C-2"].open_risks_details[0].rule_key == "rule_fail_1"
    
    # C-3 should be non_evaluable
    assert controls["C-3"].status == "non_evaluable"
    assert controls["C-3"].message is not None
    assert "audit humain" in controls["C-3"].message
