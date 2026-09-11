import asyncio
import logging
import httpx
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.models.domain import Domain, DomainStatus
from app.models.threat_intel import ThreatIntelFinding
from app.models.risk import RiskSeverity

logger = logging.getLogger(__name__)

@celery_app.task(name="monitor_certificate_transparency")
def monitor_certificate_transparency():
    asyncio.run(_async_monitor_certificate_transparency())

async def _async_monitor_certificate_transparency():
    async with AsyncSessionLocal() as session:
        domains = (await session.execute(select(Domain).where(Domain.status == DomainStatus.active))).scalars().all()
        
        now = datetime.now(timezone.utc)
        yesterday = now - timedelta(days=1)
        
        for domain in domains:
            try:
                url = f"https://crt.sh/?q=%.{domain.name}&output=json"
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        data = resp.json()
                        if not isinstance(data, list):
                            continue
                            
                        seen = set()
                        for entry in data:
                            not_before = entry.get('not_before')
                            if not not_before:
                                continue
                            try:
                                not_before_dt = datetime.strptime(not_before, "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
                            except ValueError:
                                continue
                                
                            if not_before_dt > yesterday:
                                name_value = entry.get('name_value', '').lower()
                                if name_value and name_value not in seen:
                                    seen.add(name_value)
                                    finding = ThreatIntelFinding(
                                        organization_id=domain.organization_id,
                                        source="crt.sh",
                                        finding_type="nouveau_certificat_detecte",
                                        severity=RiskSeverity.low,
                                        raw_data={
                                            "domain": domain.name,
                                            "discovered_name": name_value,
                                            "issuer_name": entry.get("issuer_name"),
                                            "not_before": not_before
                                        }
                                    )
                                    session.add(finding)
            except Exception as e:
                logger.error(f"Error checking crt.sh for {domain.name}: {e}")
                
        await session.commit()


@celery_app.task(name="run_typosquatting_check")
def run_typosquatting_check():
    asyncio.run(_async_run_typosquatting_check())

async def _async_run_typosquatting_check():
    from app.services.typosquatting_check import check_typosquatting_for_domain
    async with AsyncSessionLocal() as session:
        domains = (await session.execute(select(Domain).where(Domain.status == DomainStatus.active))).scalars().all()
        
        for domain in domains:
            try:
                await check_typosquatting_for_domain(domain, session)
            except Exception as e:
                logger.error(f"Error running dnstwist for {domain.name}: {e}")
                
        await session.commit()

@celery_app.task(name="run_data_leak_check")
def run_data_leak_check():
    asyncio.run(_async_run_data_leak_check())

async def _async_run_data_leak_check():
    from app.modules.threat_intel.connectors.hibp import HaveIBeenPwnedConnector
    hibp = HaveIBeenPwnedConnector()
    
    async with AsyncSessionLocal() as session:
        domains = (await session.execute(select(Domain).where(Domain.status == DomainStatus.active, Domain.ownership_verified == True))).scalars().all()
        
        for domain in domains:
            try:
                res = await hibp.fetch(domain.name)
                if res:
                    finding = ThreatIntelFinding(
                        organization_id=domain.organization_id,
                        source="haveibeenpwned",
                        finding_type="data_leak_exposure",
                        severity=RiskSeverity.high,
                        raw_data={
                            "domain": domain.name,
                            "total_exposed_accounts": res["total_exposed_accounts"],
                            "breach_names": res["breach_names"],
                            "latest_breach_date": res["latest_breach_date"],
                            "details": res["breaches_details"]
                        }
                    )
                    session.add(finding)
            except Exception as e:
                logger.error(f"Error running data leak check for {domain.name}: {e}")
                
        await session.commit()
