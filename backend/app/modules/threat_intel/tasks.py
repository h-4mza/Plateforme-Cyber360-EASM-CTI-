import asyncio
import logging
from sqlalchemy import select
from app.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.models.asset import Asset
from app.models.threat_intel import ThreatIntelFinding
from app.models.risk import RiskSeverity
from app.modules.monitoring.risk_engine import evaluate_risk
from .connectors.virustotal import VirusTotalConnector
from .connectors.abuseipdb import AbuseIPDBConnector
from .connectors.nvd import NVDConnector
from .connectors.misp import MISPConnector

logger = logging.getLogger(__name__)

@celery_app.task(name="analyze_asset_ti")
def analyze_asset_ti(asset_id: str):
    asyncio.run(_async_analyze_asset_ti(asset_id))

async def _async_analyze_asset_ti(asset_id: str):
    vt_connector = VirusTotalConnector()
    abuse_connector = AbuseIPDBConnector()
    async with AsyncSessionLocal() as session:
        asset = (await session.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
        if not asset:
            return
            
        target = asset.hostname if asset.hostname else asset.ip_address
        if not target:
            return

        is_ip = False
        import ipaddress
        try:
            ipaddress.ip_address(target)
            is_ip = True
        except ValueError:
            pass

        # Fetch TI
        vt_result = await vt_connector.fetch(target)
        abuse_result = await abuse_connector.fetch(target) if is_ip else None
        
        has_critical_risk = False
        findings = []

        if vt_result:
            malicious = vt_result.get("malicious_votes", 0)
            if malicious > 0:
                severity = RiskSeverity.critical if malicious > 3 else RiskSeverity.low
                if malicious > 3:
                    has_critical_risk = True
                    
                finding = ThreatIntelFinding(
                    organization_id=asset.organization_id,
                    asset_id=asset.id,
                    source="virustotal",
                    finding_type="malicious_votes",
                    severity=severity,
                    raw_data=vt_result
                )
                session.add(finding)

        if abuse_result:
            score = abuse_result.get("abuseConfidenceScore", 0)
            if score > 0:
                severity = RiskSeverity.critical if score > 25 else RiskSeverity.low
                if score > 25:
                    has_critical_risk = True
                
                finding = ThreatIntelFinding(
                    organization_id=asset.organization_id,
                    asset_id=asset.id,
                    source="abuseipdb",
                    finding_type="abuse_confidence",
                    severity=severity,
                    raw_data=abuse_result
                )
                session.add(finding)
                
        await session.commit()
        
        # Create Risk if needed
        rule_key = "ip_reputation_flagged" if is_ip else "domain_reputation_flagged"
        details = {}
        if vt_result and vt_result.get("malicious_votes", 0) > 3:
            details["virustotal"] = f"{vt_result['malicious_votes']} detections"
        if abuse_result and abuse_result.get("abuseConfidenceScore", 0) > 25:
            details["abuseipdb"] = f"Score: {abuse_result['abuseConfidenceScore']}"
            
        await evaluate_risk(
            session=session,
            asset_id=asset.id,
            rule_key=rule_key,
            is_vulnerable=has_critical_risk,
            severity=RiskSeverity.critical,
            details=details if has_critical_risk else None
        )

@celery_app.task(name="analyze_cve_nvd")
def analyze_cve_nvd(asset_id: str):
    asyncio.run(_async_analyze_cve_nvd(asset_id))

async def _async_analyze_cve_nvd(asset_id: str):
    nvd_connector = NVDConnector()
    async with AsyncSessionLocal() as session:
        asset = (await session.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
        if not asset or not asset.technology:
            return

        techs = [t.strip() for t in asset.technology.split(",")]
        
        for tech in techs:
            result = await nvd_connector.fetch(tech)
            if not result or result.get("cve_count", 0) == 0:
                continue
                
            cve_count = result["cve_count"]
            max_cvss = result["max_cvss"]
            top_cves = result["top_cves"]
            
            # Severity mapping
            if max_cvss >= 9.0:
                severity = RiskSeverity.critical
            elif max_cvss >= 7.0:
                severity = RiskSeverity.high
            elif max_cvss >= 4.0:
                severity = RiskSeverity.medium
            else:
                severity = RiskSeverity.low
                
            # Create ThreatIntelFinding
            finding = ThreatIntelFinding(
                organization_id=asset.organization_id,
                asset_id=asset.id,
                source="nvd",
                finding_type="known_cves",
                severity=severity,
                raw_data=result
            )
            session.add(finding)
            await session.commit()
            
            details = {
                "tech": tech,
                "cve_count": cve_count,
                "max_cvss": max_cvss,
                "top_cves": top_cves
            }
            
            await evaluate_risk(
                session=session,
                asset_id=asset.id,
                rule_key="known_cve_detected",
                is_vulnerable=True,
                severity=severity,
                details=details
            )

@celery_app.task(name="sync_misp_attributes_task")
def sync_misp_attributes_task():
    asyncio.run(_async_sync_misp_attributes())

async def _async_sync_misp_attributes():
    connector = MISPConnector()
    await connector.sync_misp_attributes()
