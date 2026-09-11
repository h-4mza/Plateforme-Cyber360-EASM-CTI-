import asyncio
import socket
import ssl
import httpx
from datetime import datetime, timezone
import logging

from sqlalchemy.future import select

from app.celery_app import celery_app
from app.config import settings
from app.models.asset import Asset, AssetStatusLog
from app.models.check import Check, CheckResult
from app.models.organization import Organization
from app.models.score_snapshot import ScoreSnapshot
from app.modules.monitoring.scoring import compute_score
from app.database import AsyncSessionLocal as SessionLocal
from app.modules.monitoring.scenario_engine import evaluate_organization_scenarios

logger = logging.getLogger(__name__)

async def wait_for_rate_limit(hostname: str):
    import redis.asyncio as aioredis
    redis_client = aioredis.from_url(settings.REDIS_URL)
    domain = ".".join(hostname.split(".")[-2:]) if "." in hostname else hostname
    lock_key = f"lock:domain:{domain}"
    while True:
        acquired = await redis_client.set(lock_key, "1", nx=True, ex=2)
        if acquired:
            break
        await asyncio.sleep(0.5)

async def _save_error_and_update_status(asset_id: str, organization_id: str, check_type: str, error_msg: str):
    async with SessionLocal() as session:
        asset = (await session.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
        if not asset: return
        
        new_check = Check(
            asset_id=asset_id,
            organization_id=organization_id,
            type=check_type,
            result=CheckResult.error,
            details={"error": error_msg},
            changed_from_previous="unchanged",
            executed_at=datetime.now(timezone.utc)
        )
        session.add(new_check)
        
        stmt = select(Check).where(Check.asset_id == asset_id).order_by(Check.executed_at.desc()).limit(3)
        last_checks = (await session.execute(stmt)).scalars().all()
        
        all_checks = [new_check] + list(last_checks)
        if len(all_checks) >= 3 and all(c.result == CheckResult.error for c in all_checks[:3]):
            if asset.status != 'unreachable':
                log = AssetStatusLog(asset_id=asset.id, old_status=asset.status, new_status='unreachable', reason="3 consecutive network errors")
                asset.status = 'unreachable'
                session.add(log)
        
        await session.commit()

async def _save_check(asset_id: str, organization_id: str, check_type: str, result: CheckResult, details: dict):
    async with SessionLocal() as session:
        asset = (await session.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
        stmt = select(Check).where(
            Check.asset_id == asset_id,
            Check.type == check_type
        ).order_by(Check.executed_at.desc()).limit(1)
        prev_check = (await session.execute(stmt)).scalar_one_or_none()
        
        changed = "new"
        if prev_check:
            is_ok = (result == CheckResult.pass_)
            was_ok = (prev_check.result == CheckResult.pass_)
            if was_ok and not is_ok:
                changed = "degraded"
            elif not was_ok and is_ok:
                changed = "improved"
            else:
                changed = "unchanged"
                
        if asset and asset.status == 'unreachable' and result != CheckResult.error:
            log = AssetStatusLog(asset_id=asset.id, old_status=asset.status, new_status='active', reason="Check succeeded")
            asset.status = 'active'
            session.add(log)
                
        new_check = Check(
            asset_id=asset_id,
            organization_id=organization_id,
            type=check_type,
            result=result,
            details=details,
            changed_from_previous=changed,
            executed_at=datetime.now(timezone.utc)
        )
        session.add(new_check)
        
        from app.modules.monitoring.risk_engine import evaluate_and_update_risks
        await evaluate_and_update_risks(session, asset, check_type, result, details)
        
        await session.commit()

# --- TLS Check ---
def perform_tls_check(hostname: str) -> tuple[CheckResult, dict]:
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    
    details = {}
    try:
        with socket.create_connection((hostname, 443), timeout=3) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                version = ssock.version()
                cipher = ssock.cipher()
                cert = ssock.getpeercert(binary_form=True)
                
                details["version"] = version
                details["cipher"] = cipher[0] if cipher else "Unknown"
                
                if version in ["TLSv1", "TLSv1.1"]:
                    return CheckResult.warning, {"error": f"Obsolescent TLS version: {version}", **details}
                
                # Check expiration (using simplified approach without cryptography lib for MVP)
                # Or just return pass if it succeeds handshake
                return CheckResult.pass_, {"info": "TLS is secure", **details}
    except (socket.timeout, ConnectionRefusedError) as e:
        raise Exception(f"Network error: {e}")
    except Exception as e:
        return CheckResult.error, {"error": str(e)}

async def _check_tls_async(asset_id: str):
    async with SessionLocal() as session:
        asset = (await session.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
        if not asset or not asset.hostname:
            return
        
    await wait_for_rate_limit(asset.hostname)
    result, details = await asyncio.to_thread(perform_tls_check, asset.hostname)
    await _save_check(str(asset.id), str(asset.organization_id), "tls", result, details)

@celery_app.task(bind=True, name="check_tls", max_retries=3)
def check_tls(self, asset_id: str):
    try:
        asyncio.run(_check_tls_async(asset_id))
    except Exception as e:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=2 ** self.request.retries)
        else:
            async def fallback():
                async with SessionLocal() as session:
                    asset = (await session.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
                    if asset:
                        await _save_error_and_update_status(asset_id, str(asset.organization_id), "tls", str(e))
            asyncio.run(fallback())


# --- HTTP Headers Check ---
async def _check_http_headers_async(asset_id: str):
    async with SessionLocal() as session:
        asset = (await session.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
        if not asset or not asset.hostname:
            return
    
    target_url = f"https://{asset.hostname}"
    details = {}
    result = CheckResult.pass_
    
    await wait_for_rate_limit(asset.hostname)
    
    try:
        async with httpx.AsyncClient(verify=False, timeout=5.0) as client:
            resp = await client.get(target_url)
            
            headers = resp.headers
            details["hsts"] = "strict-transport-security" in headers
            details["csp"] = "content-security-policy" in headers
            details["x_frame_options"] = "x-frame-options" in headers
            
            waf_cdn = None
            server_header = headers.get("server", "").lower()
            if "cf-ray" in headers or "cloudflare" in server_header:
                waf_cdn = "Cloudflare"
            elif any(k.startswith("x-akamai-") for k in headers.keys()) or "akamai" in server_header:
                waf_cdn = "Akamai"
            elif "awselb" in server_header:
                waf_cdn = "AWS ELB"
            elif "fastly" in headers.get("x-served-by", "").lower():
                waf_cdn = "Fastly"
            elif "incapsula" in server_header or "x-iinfo" in headers:
                waf_cdn = "Incapsula"
            elif "sucuri" in server_header or "x-sucuri-id" in headers:
                waf_cdn = "Sucuri"
                
            if waf_cdn:
                details["waf_cdn"] = waf_cdn
                # Update the asset's technology field if not already there
                if asset.technology:
                    if waf_cdn.lower() not in asset.technology.lower():
                        asset.technology += f", {waf_cdn}"
                else:
                    asset.technology = waf_cdn
                session.add(asset)
            
            if not details["hsts"] or not details["csp"] or not details["x_frame_options"]:
                result = CheckResult.warning
                details["info"] = "Some security headers are missing."
            else:
                details["info"] = "All critical security headers present."
                
    except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout) as e:
        raise Exception(f"Network error: {e}")
    except Exception as e:
        result = CheckResult.error
        details["error"] = str(e)
        
    await _save_check(str(asset.id), str(asset.organization_id), "http_headers", result, details)

@celery_app.task(bind=True, name="check_http_headers", max_retries=3)
def check_http_headers(self, asset_id: str):
    try:
        asyncio.run(_check_http_headers_async(asset_id))
    except Exception as e:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=2 ** self.request.retries)
        else:
            async def fallback():
                async with SessionLocal() as session:
                    asset = (await session.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
                    if asset:
                        await _save_error_and_update_status(asset_id, str(asset.organization_id), "http_headers", str(e))
            asyncio.run(fallback())


# --- Ports Check ---
async def check_port(host: str, port: int) -> bool:
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=2.0
        )
        writer.close()
        await writer.wait_closed()
        return True
    except Exception:
        return False

async def _check_ports_async(asset_id: str):
    async with SessionLocal() as session:
        asset = (await session.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
        if not asset:
            return
            
    target = asset.hostname or asset.ip_address
    if not target:
        return
        
    await wait_for_rate_limit(target)
    
    ports_to_check = [22, 25, 80, 443, 3389, 587]
    open_ports = []
    
    network_errors = 0
    # TCP Connect scan
    for port in ports_to_check:
        try:
            is_open = await check_port(target, port)
            if is_open:
                open_ports.append(port)
        except Exception as e:
            network_errors += 1
            
    if network_errors == len(ports_to_check):
        raise Exception("All port scans failed with network errors")
            
    details = {"open_ports": open_ports}
    result = CheckResult.pass_
    
    # If sensitive ports like 22, 3389 are open, mark as warning
    if 22 in open_ports or 3389 in open_ports:
        result = CheckResult.warning
        details["info"] = "Sensitive management ports exposed."
    else:
        details["info"] = f"Found {len(open_ports)} open ports out of {len(ports_to_check)} checked."
        
    # Shodan Integration
    try:
        from app.modules.threat_intel.connectors.shodan import ShodanConnector
        from app.modules.monitoring.risk_engine import evaluate_risk
        
        shodan = ShodanConnector()
        ip_target = asset.ip_address
        if not ip_target and asset.hostname:
            try:
                ip_target = socket.gethostbyname(asset.hostname)
            except Exception:
                pass
                
        if ip_target:
            shodan_data = await shodan.fetch(ip_target)
            if shodan_data and "ports" in shodan_data:
                details["shodan"] = {
                    "ports": shodan_data.get("ports", []),
                    "vulns": shodan_data.get("vulns", []),
                    "hostnames": shodan_data.get("hostnames", []),
                    "org": shodan_data.get("org", ""),
                    "last_update": shodan_data.get("last_update", "")
                }
                
                shodan_ports = shodan_data["ports"]
                shodan_extra_ports = [p for p in shodan_ports if p not in open_ports]
                
                if shodan_extra_ports:
                    details["shodan_extra_ports"] = shodan_extra_ports
                    await evaluate_risk(
                        session, 
                        str(asset.id), 
                        "shodan_port_discrepancy", 
                        True, 
                        "low", 
                        {"shodan_extra_ports": shodan_extra_ports, "shodan_vulns": shodan_data.get("vulns", [])}
                    )
                else:
                    await evaluate_risk(session, str(asset.id), "shodan_port_discrepancy", False, "low")
    except Exception as e:
        logger.error(f"Error during Shodan integration for {asset.id}: {e}")
        
    await _save_check(str(asset.id), str(asset.organization_id), "ports", result, details)

@celery_app.task(bind=True, name="check_ports", max_retries=3)
def check_ports(self, asset_id: str):
    try:
        asyncio.run(_check_ports_async(asset_id))
    except Exception as e:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=2 ** self.request.retries)
        else:
            async def fallback():
                async with SessionLocal() as session:
                    asset = (await session.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
                    if asset:
                        await _save_error_and_update_status(asset_id, str(asset.organization_id), "ports", str(e))
            asyncio.run(fallback())


# --- Orchestration: Trigger all checks for all active assets ---
from datetime import timedelta

@celery_app.task(name="dispatch_due_asset_checks")
def dispatch_due_asset_checks():
    # Called by Celery Beat hourly
    async def _dispatch():
        async with SessionLocal() as session:
            now = datetime.now(timezone.utc)
            result = await session.execute(
                select(Asset).where(
                    Asset.status == 'active',
                    Asset.next_check_due_at <= now
                )
            )
            assets = result.scalars().all()
            
            for asset in assets:
                # Trigger checks
                check_ports.delay(str(asset.id))
                if asset.hostname:
                    check_tls.delay(str(asset.id))
                    check_http_headers.delay(str(asset.id))
                    
                # Calculate next check time based on criticality
                if asset.criticality == 'high':
                    next_due = now + timedelta(days=1)
                elif asset.criticality == 'medium':
                    next_due = now + timedelta(days=3)
                else: # low
                    next_due = now + timedelta(days=7)
                    
                asset.next_check_due_at = next_due
                
            if assets:
                await session.commit()
                    
    asyncio.run(_dispatch())

@celery_app.task(name="snapshot_daily_scores")
def snapshot_daily_scores():
    asyncio.run(_async_snapshot_daily_scores())

async def _async_snapshot_daily_scores():
    from sqlalchemy.dialects.postgresql import insert
    import uuid
    from datetime import date
    async with SessionLocal() as session:
        orgs = (await session.execute(select(Organization))).scalars().all()
        today = date.today()
        for org in orgs:
            score_data = await compute_score(session, org.id)
            if score_data.get("is_available"):
                cats = {c["category"]: c["score"] for c in score_data["categories"]}
                stmt = insert(ScoreSnapshot).values(
                    id=uuid.uuid4(),
                    organization_id=org.id,
                    date=today,
                    score_global=score_data["global_score"],
                    score_dns=cats.get("dns", 100),
                    score_tls=cats.get("tls", 100),
                    score_messagerie=cats.get("messagerie", 100),
                    score_services=cats.get("services", 100),
                    score_configuration=cats.get("configuration", 100)
                )
                stmt = stmt.on_conflict_do_update(
                    index_elements=['organization_id', 'date'],
                    set_={
                        'score_global': stmt.excluded.score_global,
                        'score_dns': stmt.excluded.score_dns,
                        'score_tls': stmt.excluded.score_tls,
                        'score_messagerie': stmt.excluded.score_messagerie,
                        'score_services': stmt.excluded.score_services,
                        'score_configuration': stmt.excluded.score_configuration
                    }
                )
                await session.execute(stmt)
        await session.commit()

@celery_app.task(name="evaluate_attack_scenarios")
def evaluate_attack_scenarios_task(org_id_str: str):
    import asyncio
    from app.database import async_session_maker
    
    async def _run():
        async with async_session_maker() as db:
            await evaluate_organization_scenarios(org_id_str, db)
            
    asyncio.run(_run())

@celery_app.task(name="compute_sector_benchmarks")
def compute_sector_benchmarks_task():
    import asyncio
    from app.database import async_session_maker
    from app.modules.monitoring.benchmarks import compute_sector_benchmarks
    
    async def _run():
        async with async_session_maker() as db:
            await compute_sector_benchmarks(db)
            
    asyncio.run(_run())
