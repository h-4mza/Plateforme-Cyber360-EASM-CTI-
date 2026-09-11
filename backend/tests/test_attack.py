import pytest
from app.modules.monitoring.risk_engine import map_risk_to_techniques
from app.api.attack import compute_group_exposure
from sqlalchemy.dialects.postgresql import insert

MINIMAL_STIX_BUNDLE = {
    "type": "bundle",
    "id": "bundle--5d0092c5",
    "spec_version": "2.1",
    "objects": [
        {
            "type": "x-mitre-tactic",
            "id": "x-mitre-tactic--8c0b",
            "created": "2018-10-17T00:14:20.652Z",
            "modified": "2019-07-19T17:49:10.021Z",
            "name": "Initial Access",
            "description": "The adversary is trying to get into your network.",
            "x_mitre_shortname": "initial-access",
            "external_references": [{"source_name": "mitre-attack", "external_id": "TA0001", "url": "https://attack.mitre.org/tactics/TA0001"}]
        },
        {
            "type": "attack-pattern",
            "id": "attack-pattern--767a",
            "created": "2020-02-11T18:49:50.046Z",
            "modified": "2020-03-30T13:46:16.896Z",
            "name": "Spearphishing Link",
            "description": "Adversaries may send spearphishing emails...",
            "kill_chain_phases": [{"kill_chain_name": "mitre-attack", "phase_name": "initial-access"}],
            "x_mitre_is_subtechnique": True,
            "x_mitre_platforms": ["Windows", "macOS", "Linux"],
            "external_references": [{"source_name": "mitre-attack", "external_id": "T1566.002", "url": "https://attack.mitre.org/techniques/T1566/002"}]
        },
        {
            "type": "intrusion-set",
            "id": "intrusion-set--899c",
            "created": "2017-05-31T21:31:52.747Z",
            "modified": "2020-03-30T16:51:25.590Z",
            "name": "APT29",
            "description": "APT29 is a threat group...",
            "aliases": ["APT29", "Cozy Bear"],
            "external_references": [{"source_name": "mitre-attack", "external_id": "G0016", "url": "https://attack.mitre.org/groups/G0016"}]
        },
        {
            "type": "relationship",
            "id": "relationship--c8a8",
            "created": "2020-03-30T16:51:25.594Z",
            "modified": "2020-03-30T16:51:25.594Z",
            "relationship_type": "uses",
            "source_ref": "intrusion-set--899c",
            "target_ref": "attack-pattern--767a"
        }
    ]
}

@pytest.mark.asyncio
async def test_compute_group_exposure():
    group_techniques = ["T1566.002", "T1021.001", "T1190"]
    tech_stats = {
        "T1566.002": {"count": 2, "max_severity": 3},  # High
        "T1021.001": {"count": 1, "max_severity": 4},  # Critical
        "T9999": {"count": 1, "max_severity": 2}       # Irrelevant to group
    }
    
    result = compute_group_exposure(group_techniques, tech_stats)
    
    assert result["matching_techniques_count"] == 2
    assert result["level"] == "critical"
    assert result["score"] == 8

@pytest.mark.asyncio
async def test_risk_mapping_engine(monkeypatch):
    monkeypatch.setattr('app.modules.monitoring.risk_engine.get_technique_mapping', lambda: {
        "spf_missing": ["T1566", "T1566.002"]
    })
    
    class FakeSession:
        def __init__(self):
            self.executed_stmts = []
        async def execute(self, stmt):
            self.executed_stmts.append(stmt)
            
    session = FakeSession()
    
    risk_id = "test-risk-id"
    await map_risk_to_techniques(session, risk_id, "spf_missing")
    
    assert len(session.executed_stmts) == 1
    stmt = session.executed_stmts[0]
    
    compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    assert "test-risk-id" in compiled
    assert "T1566" in compiled

@pytest.mark.asyncio
async def test_attack_sync_parsing(monkeypatch):
    from app.services.attack_sync import sync_mitre_attack_data
    
    class FakeResponse:
        def raise_for_status(self): pass
        def json(self): return MINIMAL_STIX_BUNDLE
        @property
        def content(self): return b'mock_content'
        
    class FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self, exc_type, exc, tb): pass
        async def get(self, url, **kwargs): return FakeResponse()
        
    monkeypatch.setattr('httpx.AsyncClient', lambda: FakeClient())
    
    class FakeSession:
        def __init__(self):
            self.added = []
        def add(self, obj):
            self.added.append(obj)
        async def flush(self): pass
        async def commit(self): pass
        async def execute(self, stmt):
            class FakeResult:
                def scalars(self):
                    class FakeScalars:
                        def all(self): return []
                    return FakeScalars()
                def scalar(self): return None
            return FakeResult()
            
    fake_session = FakeSession()
    
    class FakeSessionContextManager:
        async def __aenter__(self): return fake_session
        async def __aexit__(self, exc_type, exc_val, exc_tb): pass
        
    monkeypatch.setattr('app.services.attack_sync.AsyncSessionLocal', lambda: FakeSessionContextManager())
    
    stats = await sync_mitre_attack_data()
    
    assert stats["tactics"] == 1
    assert stats["techniques"] == 1
    assert stats["groups"] == 1
