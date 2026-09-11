import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone
from app.models.asset import Asset
from app.models.check import CheckResult
from app.models.risk import Risk, RiskStatus
from app.modules.monitoring.risk_engine import evaluate_and_update_risks

@pytest.mark.asyncio
async def test_risk_engine_lifecycle():
    # 1. Setup mock asset
    asset = Asset(id=uuid.uuid4(), organization_id=uuid.uuid4(), type="subdomain", hostname="test.com", status="active", criticality="high")
    
    # Setup mock session
    session = AsyncMock()
    
    # 2. Test opening a new risk (spf_missing)
    details = {"info": "SPF absent"}
    
    # Mock existing risk query to return None (no open risk)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    session.execute.return_value = mock_result
    
    await evaluate_and_update_risks(session, asset, "spf", CheckResult.fail, details)
    
    # Verify risk was added to session
    assert session.add.called
    added_risk = session.add.call_args[0][0]
    assert isinstance(added_risk, Risk)
    assert added_risk.rule_key == "spf_missing"
    assert added_risk.status == RiskStatus.open
    
    # 3. Test non-duplication (upsert)
    # Reset mock
    session.add.reset_mock()
    
    # Mock existing open risk
    existing_risk = Risk(id=uuid.uuid4(), rule_key="spf_missing", status=RiskStatus.open, last_seen_at=datetime.now(timezone.utc))
    old_last_seen = existing_risk.last_seen_at
    mock_result.scalar_one_or_none.return_value = existing_risk
    
    await evaluate_and_update_risks(session, asset, "spf", CheckResult.fail, details)
    
    # Verify no new risk was added, but existing was updated
    assert not session.add.called
    assert existing_risk.last_seen_at > old_last_seen
    
    # 4. Test resolving a risk
    details = {"info": "SPF valide: -all"} # This will trigger evaluate_spf_missing to return False
    
    await evaluate_and_update_risks(session, asset, "spf", CheckResult.pass_, details)
    
    assert existing_risk.status == RiskStatus.resolved
    assert existing_risk.resolved_at is not None
    
    # 5. Test network error (CheckResult.error) does not trigger evaluation
    session.execute.reset_mock()
    existing_risk.status = RiskStatus.open # reopen
    
    details = {"error": "Timeout"}
    await evaluate_and_update_risks(session, asset, "spf", CheckResult.error, details)
    
    # The session.execute should NOT be called (engine bails out early)
    assert not session.execute.called
    assert existing_risk.status == RiskStatus.open # unchanged
