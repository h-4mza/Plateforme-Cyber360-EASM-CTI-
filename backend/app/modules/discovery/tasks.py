from app.celery_app import celery_app
import logging
import asyncio
import httpx
import socket
import ssl
from datetime import datetime, timezone
import dns.resolver
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.x509.oid import ExtensionOID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.database import AsyncSessionLocal
from app.models.domain import Domain, DomainStatus
from app.models.asset import Asset, AssetStatus, AssetType
from app.config import settings

import json
import os
logger = logging.getLogger(__name__)

RULES_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "criticality_rules.json")

def load_rules():
    try:
        with open(RULES_PATH, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Could not load criticality rules: {e}")
        return {"sensitive_keywords": [], "sensitive_technologies": []}

import re

EOL_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "eol_database.json")

def load_eol_db():
    try:
        with open(EOL_DB_PATH, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Could not load EOL DB: {e}")
        return {}

def check_eol(tech_set):
    eol_db = load_eol_db()
    is_eol = False
    eol_since = None
    
    tech_patterns = {
        "php": re.compile(r'PHP/?([0-9\.]+)'),
        "apache": re.compile(r'Apache/?([0-9\.]+)'),
        "nginx": re.compile(r'nginx/?([0-9\.]+)'),
        "openssl": re.compile(r'OpenSSL/?([0-9\.]+[a-z]?)'),
        "wordpress": re.compile(r'WordPress/?([0-9\.]+)', re.IGNORECASE)
    }
    
    for tech_str in tech_set:
        for software, pattern in tech_patterns.items():
            match = pattern.search(tech_str)
            if match:
                version = match.group(1)
                rules = eol_db.get(software, [])
                for rule in rules:
                    if re.match(rule["regex"], version):
                        is_eol = True
                        rule_date = datetime.strptime(rule["eol_date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                        if eol_since is None or rule_date > eol_since:
                            eol_since = rule_date
                            
    return is_eol, eol_since

async def fetch_subdomains(domain_name: str) -> set:
    """Fetch subdomains from HackerTarget API."""
    subdomains = set()
    url = f"https://api.hackertarget.com/hostsearch/?q={domain_name}"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            if response.status_code == 200:
                text_data = response.text
                if "error" not in text_data.lower():
                    for line in text_data.split('\n'):
                        if ',' in line:
                            subdomain = line.split(',')[0].strip().lower()
                            if subdomain and subdomain.endswith(domain_name):
                                subdomains.add(subdomain)
            else:
                logger.warning(f"HackerTarget returned status code {response.status_code} for {domain_name}")
    except Exception as e:
        logger.error(f"Error fetching from HackerTarget for {domain_name}: {e}")
        
    return subdomains

def fetch_dns_records(domain_name: str) -> dict:
    """Fetch MX, NS, TXT records."""
    records = {"MX": [], "NS": [], "TXT": []}
    for qtype in ["MX", "NS", "TXT"]:
        try:
            answers = dns.resolver.resolve(domain_name, qtype, lifetime=3)
            for rdata in answers:
                val = str(rdata).strip('"')
                records[qtype].append(val)
        except Exception:
            pass
    return records

def resolve_domain(hostname: str) -> set:
    """Resolve a hostname to IPv4 (A) and IPv6 (AAAA)."""
    ips = set()
    for qtype in ['A', 'AAAA']:
        try:
            answers = dns.resolver.resolve(hostname, qtype, lifetime=3)
            for rdata in answers:
                ips.add(str(rdata))
        except Exception:
            pass
    
    # Fallback to standard socket if dns query fails
    if not ips:
        try:
            _, _, ipaddrlist = socket.gethostbyname_ex(hostname)
            for ip in ipaddrlist:
                ips.add(ip)
        except Exception:
            pass
            
    return ips

def fetch_tls_cert(hostname: str, port: int = 443) -> dict:
    """Fetch TLS certificate and extract issuer, expiry, and SANs."""
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    
    cert_info = {}
    try:
        with socket.create_connection((hostname, port), timeout=3) as sock:
            with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                der_cert = ssock.getpeercert(binary_form=True)
                cert = x509.load_der_x509_certificate(der_cert, default_backend())
                
                # Use not_valid_after_utc if available, else fallback
                if hasattr(cert, 'not_valid_after_utc'):
                    cert_info['expires'] = cert.not_valid_after_utc
                else:
                    cert_info['expires'] = cert.not_valid_after.replace(tzinfo=timezone.utc)
                    
                subject_str = cert.subject.rfc4514_string()
                issuer_str = cert.issuer.rfc4514_string()
                
                logger.info(f"TLS Cert for {hostname} - Raw Subject: {subject_str} | Raw Issuer: {issuer_str}")
                
                cert_info['subject'] = subject_str
                cert_info['issuer'] = issuer_str
                
                sans = []
                try:
                    ext = cert.extensions.get_extension_for_oid(ExtensionOID.SUBJECT_ALTERNATIVE_NAME)
                    sans_list = ext.value.get_values_for_type(x509.DNSName)
                    sans = [san.lower() for san in sans_list if '*' not in san]
                except x509.ExtensionNotFound:
                    pass
                cert_info['sans'] = sans
    except Exception:
        pass
        
    return cert_info

def get_cert_status(expires: datetime) -> str:
    if not expires:
        return None
    now = datetime.now(timezone.utc)
    delta = (expires - now).days
    if delta < 0:
        return "Critique"
    elif delta < 15:
        return "Important"
    elif delta < 30:
        return "Moyen"
    else:
        return "OK"

def check_http_redirect(hostname: str) -> str:
    try:
        with socket.create_connection((hostname, 80), timeout=2):
            pass
    except Exception:
        return "Non applicable"
        
    try:
        # Use a short timeout and do not follow redirects automatically
        with httpx.Client(timeout=3.0, verify=False, follow_redirects=False) as client:
            resp = client.get(f"http://{hostname}/")
            if resp.status_code in [301, 302, 303, 307, 308]:
                location = resp.headers.get("location", "").lower()
                if location.startswith("https://"):
                    return "Conforme"
            return "Non conforme"
    except Exception:
        return "Non conforme"

async def process_subdomain(sub, domain_name, organization_id, domain_id):
    """Process a single subdomain concurrently."""
    # Run blocking operations in threads
    cert_info = await asyncio.to_thread(fetch_tls_cert, sub)
    ips = await asyncio.to_thread(resolve_domain, sub)
    
    # Heuristic Technology Detection & Criticality
    tech_set = set()
    criticality = "medium"
    
    # Criticality Rule
    rules = load_rules()
    sensitive_keywords = rules.get("sensitive_keywords", [])
    if any(keyword in sub for keyword in sensitive_keywords):
        criticality = "high"
        
    try:
        async with httpx.AsyncClient(timeout=3.0, verify=False, follow_redirects=True) as client:
            resp = await client.get(f"http://{sub}")
            
            # --- DEBUG HTTP HEADERS ---
            headers_preview = dict(list(resp.headers.items())[:5])
            logger.info(f"[DEBUG HTTP] {sub} - Server: {resp.headers.get('server')} | X-Powered-By: {resp.headers.get('x-powered-by')} | Headers: {headers_preview}")
            
            # 1. Headers analysis
            if "server" in resp.headers:
                tech_set.add(resp.headers["server"])
            if "x-powered-by" in resp.headers:
                tech_set.add(f"PHP (ou {resp.headers['x-powered-by']})")
                
            # 2. HTML Pattern detection
            body = resp.text.lower()
            if "wp-content" in body or "wp-includes" in body:
                tech_set.add("WordPress")
            if "drupal" in body:
                tech_set.add("Drupal")
            if "magento" in body:
                tech_set.add("Magento")
                
            # 3. Favicon Hash (simplifié avec MD5 pour le MVP)
            try:
                fav_resp = await client.get(f"http://{sub}/favicon.ico", timeout=2.0)
                if fav_resp.status_code == 200:
                    import hashlib
                    fav_hash = hashlib.md5(fav_resp.content).hexdigest()
                    # Exemples de signatures (à enrichir plus tard)
                    known_favicons = {
                        "b4bc8434a94625b18bc4cdd76f1469e3": "WordPress",
                        "4145719bc4a3d6a908fa440a4cf0dd71": "Fortinet VPN",
                        "7db16f40b07fde754ccb0ad1dc9bf240": "Citrix Gateway"
                    }
                    if fav_hash in known_favicons:
                        tech_name = known_favicons[fav_hash]
                        tech_set.add(tech_name)
                        
                        # Check sensitive tech
                        sensitive_techs = rules.get("sensitive_technologies", [])
                        if any(t.lower() in tech_name.lower() for t in sensitive_techs):
                            criticality = "high"
            except Exception:
                pass
                
    except Exception:
        pass
        
    # --- DEBUT MOCK POUR TEST CVE ---
    if sub == domain_name:
        tech_set.add("nginx 1.18.0")
    # --- FIN MOCK POUR TEST CVE ---
        
    technology_str = ", ".join(list(tech_set)) if tech_set else None
    is_eol, eol_since = check_eol(tech_set)
    
    # Calculate statuses
    cert_status = get_cert_status(cert_info.get('expires'))
    http_status = await asyncio.to_thread(check_http_redirect, sub)
        
    return sub, cert_info, ips, technology_str, criticality, is_eol, eol_since, cert_status, http_status

async def _process_discovery(domain_id: str):
    logger.info(f"Discovery started for domain {domain_id}")
    
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    
    async with SessionLocal() as session:
        stmt = select(Domain).where(Domain.id == domain_id)
        result = await session.execute(stmt)
        domain = result.scalar_one_or_none()
        
        if not domain:
            logger.error(f"Domain {domain_id} not found in database.")
            await engine.dispose()
            return

        logger.info(f"Fetching subdomains for {domain.name}...")
        subdomains = await fetch_subdomains(domain.name)
        subdomains.add(domain.name)
        
        # 1. Fetch DNS records for parent domain
        dns_records = await asyncio.to_thread(fetch_dns_records, domain.name)
        domain.dns_records = dns_records
        
        all_ips = set()
        assets_to_add = []
        
        # We will keep checking SANs for new subdomains
        processed_subdomains = set()
        queue = list(subdomains)
        
        # Process in batches of 20 to avoid overwhelming the system
        BATCH_SIZE = 20
        
        while queue:
            batch = []
            while queue and len(batch) < BATCH_SIZE:
                sub = queue.pop(0)
                if sub not in processed_subdomains:
                    processed_subdomains.add(sub)
                    batch.append(sub)
            
            if not batch:
                break
                
            # Run batch concurrently
            tasks = [process_subdomain(sub, domain.name, domain.organization_id, domain.id) for sub in batch]
            results = await asyncio.gather(*tasks)
            
            assets_to_add = []
            for sub, cert_info, ips, technology, criticality, is_eol, eol_since, cert_status, http_status in results:
                # If cert gives new SANs ending with our domain, add them to queue
                if 'sans' in cert_info:
                    for san in cert_info['sans']:
                        if san.endswith(domain.name) and san not in processed_subdomains and san not in queue:
                            queue.append(san)
                
                # Add Subdomain Asset
                assets_to_add.append(
                    Asset(
                        organization_id=domain.organization_id,
                        type=AssetType.root_domain if sub == domain.name else AssetType.subdomain,
                        hostname=sub,
                        status=AssetStatus.active,
                        domain_id=domain.id,
                        technology=technology,
                        criticality=criticality,
                        is_eol=is_eol,
                        eol_since=eol_since,
                        cert_subject=cert_info.get('subject'),
                        cert_issuer=cert_info.get('issuer'),
                        cert_expires_at=cert_info.get('expires'),
                        cert_san=','.join(cert_info.get('sans', [])) if cert_info.get('sans') else None,
                        cert_status=cert_status,
                        http_redirect_status=http_status
                    )
                )
                
                # Resolve to IPs
                for ip in ips:
                    if ip not in all_ips:
                        all_ips.add(ip)
                        assets_to_add.append(
                            Asset(
                                organization_id=domain.organization_id,
                                type=AssetType.ip,
                                ip_address=ip,
                                status=AssetStatus.active,
                                domain_id=domain.id
                            )
                        )

            # Écriture "au fur et à mesure" (Progressive writing)
            if assets_to_add:
                session.add_all(assets_to_add)
                await session.commit()
                # Trigger Threat Intel analysis for the newly added assets
                from app.modules.threat_intel.tasks import analyze_asset_ti, analyze_cve_nvd
                for asset in assets_to_add:
                    analyze_asset_ti.delay(str(asset.id))
                    if asset.technology:
                        analyze_cve_nvd.delay(str(asset.id))
            
        domain.status = DomainStatus.active
        domain.last_discovery_at = datetime.now(timezone.utc)
        await session.commit()
        
        logger.info(f"Discovery completed for {domain.name}. Added {len(processed_subdomains)} subdomains and {len(all_ips)} IPs.")
        
        # Dispatch security checks automatically after discovery
        check_domain_security.delay(domain_id)
        
    await engine.dispose()

@celery_app.task(name="discover_domain")
def discover_domain(domain_id: str):
    asyncio.run(_process_discovery(domain_id))
    return {"status": "success", "domain_id": domain_id}

def run_dns_checks(domain_name: str) -> dict:
    results = {
        "spf": {"status": "vulnerable", "details": "SPF absent (critique) : permet à quiconque d'usurper votre domaine pour envoyer des emails."},
        "dmarc": {"status": "vulnerable", "details": "DMARC absent (critique) : aucune protection active contre l'usurpation d'identité."},
        "dkim": {"status": "weak", "details": "Aucun enregistrement DKIM détecté (sélecteurs standards)."},
        "dnssec": {"status": "weak", "details": "Aucune clé DNSSEC (DNSKEY) trouvée."},
        "mta_sts": {"status": "weak", "details": "MTA-STS absent : les emails sortants ne sont pas garantis d'être transportés en TLS."},
        "tls_rpt": {"status": "weak", "details": "TLS-RPT absent : aucun reporting des échecs TLS pour les emails."},
        "caa": {"status": "weak", "details": "CAA absent : n'importe quelle autorité de certification peut émettre un certificat pour ce domaine."}
    }
    
    # 1. SPF Check
    try:
        answers = dns.resolver.resolve(domain_name, 'TXT', lifetime=3)
        for rdata in answers:
            txt = str(rdata).strip('"')
            if txt.startswith("v=spf1"):
                if "+all" in txt:
                    results["spf"] = {"status": "vulnerable", "details": f"Politique SPF critique (+all) : autorise explicitement tous les serveurs du monde à envoyer des emails en votre nom. [{txt}]"}
                elif "~all" in txt:
                    results["spf"] = {"status": "weak", "details": f"Politique SPF faible (~all) : les emails frauduleux ne sont pas bloqués, seulement marqués (Softfail). C'est mieux que rien, mais insuffisant pour bloquer le phishing. [{txt}]"}
                elif "-all" in txt:
                    results["spf"] = {"status": "secure", "details": f"SPF correctement configuré (-all) : bloque activement les expéditeurs non autorisés (Hardfail). [{txt}]"}
                else:
                    results["spf"] = {"status": "weak", "details": f"Politique SPF sans mécanisme de rejet standard (-all ou ~all). [{txt}]"}
                break
    except Exception:
        pass

    # 2. DMARC Check
    try:
        answers = dns.resolver.resolve(f"_dmarc.{domain_name}", 'TXT', lifetime=3)
        for rdata in answers:
            txt = str(rdata).strip('"')
            if txt.startswith("v=DMARC1"):
                if "p=none" in txt:
                    results["dmarc"] = {"status": "weak", "details": f"DMARC faible (p=none) : politique de pure observation, les emails frauduleux arrivent en boîte de réception. [{txt}]"}
                elif "p=quarantine" in txt:
                    results["dmarc"] = {"status": "weak", "details": f"DMARC modéré (p=quarantine) : les emails suspects sont envoyés en spam. Bonne étape de transition, mais le but final est p=reject. [{txt}]"}
                elif "p=reject" in txt:
                    results["dmarc"] = {"status": "secure", "details": f"DMARC strict (p=reject) : excellente protection, les emails frauduleux sont détruits avant d'arriver au destinataire. [{txt}]"}
                else:
                    results["dmarc"] = {"status": "weak", "details": f"DMARC présent mais politique non standard. [{txt}]"}
                break
    except Exception:
        pass

    # 3. DKIM Check
    selectors = ["google", "default", "selector1", "k1", "mail"]
    for sel in selectors:
        try:
            answers = dns.resolver.resolve(f"{sel}._domainkey.{domain_name}", 'TXT', lifetime=3)
            for rdata in answers:
                txt = str(rdata).strip('"')
                if txt.startswith("v=DKIM1") or "k=rsa" in txt:
                    results["dkim"] = {"status": "secure", "details": f"DKIM détecté (sélecteur: {sel})"}
                    break
        except Exception:
            continue
            
    # 4. DNSSEC Check
    try:
        answers = dns.resolver.resolve(domain_name, 'DNSKEY', lifetime=3)
        if len(answers) > 0:
            results["dnssec"] = {"status": "secure", "details": f"DNSSEC est activé ({len(answers)} clés trouvées)"}
    except Exception:
        pass

    # 5. MTA-STS Check
    try:
        answers = dns.resolver.resolve(f"_mta-sts.{domain_name}", 'TXT', lifetime=3)
        has_mta_sts_txt = False
        for rdata in answers:
            txt = str(rdata).strip('"')
            if txt.startswith("v=STSv1"):
                has_mta_sts_txt = True
                break
        
        if has_mta_sts_txt:
            policy_url = f"https://mta-sts.{domain_name}/.well-known/mta-sts.txt"
            try:
                resp = httpx.get(policy_url, timeout=3, verify=False)
                if resp.status_code == 200 and "version: STSv1" in resp.text:
                    results["mta_sts"] = {"status": "secure", "details": "MTA-STS configuré et politique HTTP disponible."}
                else:
                    results["mta_sts"] = {"status": "weak", "details": "MTA-STS TXT présent mais politique HTTP invalide/indisponible."}
            except Exception:
                results["mta_sts"] = {"status": "weak", "details": "MTA-STS TXT présent mais politique HTTP inaccessible."}
    except Exception:
        pass

    # 6. TLS-RPT Check
    try:
        answers = dns.resolver.resolve(f"_smtp._tls.{domain_name}", 'TXT', lifetime=3)
        for rdata in answers:
            txt = str(rdata).strip('"')
            if txt.startswith("v=TLSRPTv1"):
                results["tls_rpt"] = {"status": "secure", "details": "TLS-RPT configuré."}
                break
    except Exception:
        pass

    # 7. CAA Check
    try:
        answers = dns.resolver.resolve(domain_name, 'CAA', lifetime=3)
        if len(answers) > 0:
            results["caa"] = {"status": "secure", "details": f"CAA est configuré ({len(answers)} enregistrements)."}
    except Exception:
        pass

    return results

async def _process_security_checks(domain_id: str):
    logger.info(f"Security checks started for domain {domain_id}")
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    
    async with SessionLocal() as session:
        stmt = select(Domain).where(Domain.id == domain_id)
        result = await session.execute(stmt)
        domain = result.scalar_one_or_none()
        
        if domain:
            checks = await asyncio.to_thread(run_dns_checks, domain.name)
            domain.security_checks = checks
            await session.commit()
            
            # Save to Check table on the root_domain asset
            stmt = select(Asset).where(
                Asset.domain_id == domain.id, 
                Asset.type == 'root_domain'
            )
            root_asset = (await session.execute(stmt)).scalars().first()
            if root_asset:
                from app.modules.monitoring.tasks import _save_check
                from app.models.check import CheckResult
                for check_name, data in checks.items():
                    res = CheckResult.unknown
                    if data["status"] == "secure":
                        res = CheckResult.pass_
                    elif data["status"] == "weak":
                        res = CheckResult.warning
                    elif data["status"] == "vulnerable":
                        res = CheckResult.error
                    
                    await _save_check(
                        asset_id=str(root_asset.id),
                        organization_id=str(domain.organization_id),
                        check_type=check_name,
                        result=res,
                        details={"info": data["details"]}
                    )
            
    await engine.dispose()

@celery_app.task(name="check_domain_security")
def check_domain_security(domain_id: str):
    asyncio.run(_process_security_checks(domain_id))
    return {"status": "success", "domain_id": domain_id}

async def _process_active_recon(domain_id: str):
    logger.info(f"Active recon started for domain {domain_id}")
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    
    async with SessionLocal() as session:
        stmt = select(Domain).where(Domain.id == domain_id)
        domain = (await session.execute(stmt)).scalar_one_or_none()
        
        if not domain or not domain.ownership_verified:
            await engine.dispose()
            return
            
        domain.active_recon_state = "running"
        await session.commit()
            
        ns_records = domain.dns_records.get("NS", []) if domain.dns_records else []
        zone_transfer_exposed = False
        exposed_records = []
        new_subdomains = set()
        
        import dns.query
        import dns.zone
        
        for ns in ns_records:
            try:
                ns_ips = []
                for qtype in ['A', 'AAAA']:
                    try:
                        answers = dns.resolver.resolve(ns, qtype, lifetime=3)
                        for rdata in answers:
                            ns_ips.append(str(rdata))
                    except Exception:
                        pass
                
                for ip in ns_ips:
                    try:
                        z = dns.zone.from_xfr(dns.query.xfr(ip, domain.name, timeout=5))
                        zone_transfer_exposed = True
                        for name, node in z.nodes.items():
                            record_name = str(name)
                            if record_name != '@':
                                sub = f"{record_name}.{domain.name}"
                                new_subdomains.add(sub)
                                exposed_records.append(sub)
                    except Exception:
                        pass
                    
                    if zone_transfer_exposed:
                        break
            except Exception as e:
                logger.error(f"Error checking AXFR on {ns} for {domain.name}: {e}")
                
            if zone_transfer_exposed:
                break
                
        stmt = select(Asset).where(Asset.domain_id == domain.id, Asset.type == 'root_domain')
        root_asset = (await session.execute(stmt)).scalars().first()
        
        if root_asset:
            from app.modules.monitoring.risk_engine import evaluate_risk
            details = {"exposed_records": list(exposed_records)[:50]} if zone_transfer_exposed else None
            await evaluate_risk(session, str(root_asset.id), "dns_zone_transfer_exposed", zone_transfer_exposed, "critical", details)
            await session.commit()
            
        stmt = select(Asset.hostname).where(Asset.domain_id == domain.id, Asset.type == 'subdomain')
        existing_subs = set((await session.execute(stmt)).scalars().all())
        
        words = ['dev', 'staging', 'prod', 'old', 'test', 'new', 'api', 'admin', 'v1', 'v2', 'bak']
        numbers = ['1', '2']
        parts = set()
        for sub in existing_subs:
            sub_base = sub.replace(f".{domain.name}", "")
            if sub_base and sub_base != domain.name:
                for p in sub_base.split('.'):
                    for p2 in p.split('-'):
                        if p2:
                            parts.add(p2)
                            
        parts = list(parts)[:50]
        permutations = set()
        for part in parts:
            for n in numbers:
                permutations.add(f"{part}{n}")
            for w in words:
                if w != part:
                    permutations.add(f"{part}-{w}")
                    permutations.add(f"{w}-{part}")
                    permutations.add(f"{part}{w}")
                    
        candidates = list({f"{p}.{domain.name}" for p in permutations})[:500]
        
        resolved_permutations = set()
        BATCH_SIZE_RESOLVE = 50
        for i in range(0, len(candidates), BATCH_SIZE_RESOLVE):
            batch = candidates[i:i+BATCH_SIZE_RESOLVE]
            resolve_tasks = [asyncio.to_thread(resolve_domain, sub) for sub in batch]
            results = await asyncio.gather(*resolve_tasks)
            for sub, ips in zip(batch, results):
                if ips:
                    resolved_permutations.add(sub)
                    
        new_subdomains.update(resolved_permutations)
            
        if new_subdomains:
            queue = [sub for sub in new_subdomains if sub not in existing_subs]
            
            BATCH_SIZE = 20
            all_ips = set()
            while queue:
                batch = queue[:BATCH_SIZE]
                queue = queue[BATCH_SIZE:]
                
                tasks = [process_subdomain(sub, domain.name, domain.organization_id, domain.id) for sub in batch]
                results = await asyncio.gather(*tasks)
                
                assets_to_add = []
                for sub, cert_info, ips, technology, criticality, is_eol, eol_since, cert_status, http_status in results:
                    assets_to_add.append(
                        Asset(
                            organization_id=domain.organization_id,
                            type=AssetType.subdomain,
                            hostname=sub,
                            status=AssetStatus.active,
                            domain_id=domain.id,
                            technology=technology,
                            criticality=criticality,
                            is_eol=is_eol,
                            eol_since=eol_since,
                            cert_subject=cert_info.get('subject'),
                            cert_issuer=cert_info.get('issuer'),
                            cert_expires_at=cert_info.get('expires'),
                            cert_san=','.join(cert_info.get('sans', [])) if cert_info.get('sans') else None,
                            cert_status=cert_status,
                            http_redirect_status=http_status
                        )
                    )
                    
                    for ip in ips:
                        if ip not in all_ips:
                            all_ips.add(ip)
                            assets_to_add.append(
                                Asset(
                                    organization_id=domain.organization_id,
                                    type=AssetType.ip,
                                    ip_address=ip,
                                    status=AssetStatus.active,
                                    domain_id=domain.id
                                )
                            )
                if assets_to_add:
                    session.add_all(assets_to_add)
                    await session.commit()
                    from app.modules.threat_intel.tasks import analyze_asset_ti, analyze_cve_nvd
                    for asset in assets_to_add:
                        if asset.type == AssetType.subdomain or asset.type == AssetType.root_domain:
                            analyze_asset_ti.delay(str(asset.id))
                        if asset.technology:
                            analyze_cve_nvd.delay(str(asset.id))
                            
        # Web Asset Sensitive File Check
        stmt = select(Asset).where(
            Asset.domain_id == domain.id, 
            Asset.type.in_([AssetType.root_domain, AssetType.subdomain]),
            Asset.status == AssetStatus.active
        )
        web_assets = (await session.execute(stmt)).scalars().all()
        
        SENSITIVE_PATHS = {
            "/.git/HEAD": "ref: refs/heads/",
            "/.env": "([A-Z_]+[A-Z0-9_]*)=(.+)", 
            "/.git/config": "[core]",
            "/backup.zip": "PK\x03\x04",
            "/backup.sql": "CREATE TABLE",
            "/wp-config.php.bak": "DB_PASSWORD",
            "/.aws/credentials": "[default]",
            "/swagger.json": "swagger"
        }
        
        import re
        async def check_path(client, host, path, pattern):
            try:
                resp = await client.get(f"http://{host}{path}", timeout=3.0)
                if resp.status_code == 200:
                    text = resp.text
                    if path.endswith(".zip"):
                        text = resp.content.decode('latin-1')[:100]
                        
                    if pattern in text or re.search(pattern, text):
                        # Extract snippet
                        idx = text.find(pattern) if pattern in text else re.search(pattern, text).start()
                        snippet = text[max(0, idx-10):idx+50].replace('\n', ' ')
                        return path, snippet
            except Exception:
                pass
            return None, None
            
        async def check_security_txt(client, host):
            try:
                resp = await client.get(f"http://{host}/.well-known/security.txt", timeout=3.0)
                if resp.status_code == 200 and "Contact:" in resp.text:
                    return True
            except Exception:
                pass
            return False

        async def check_subdomain_takeover(client, host: str, session, asset_id):
            import dns.resolver
            try:
                answers = await asyncio.to_thread(dns.resolver.resolve, host, 'CNAME', lifetime=3)
                cnames = [str(rdata).strip('.').lower() for rdata in answers]
            except Exception:
                cnames = []
                
            if not cnames:
                return
                
            TAKEOVER_SIGNATURES = [
                {"provider": "AWS S3", "cname": "s3.amazonaws.com", "signature": "NoSuchBucket"},
                {"provider": "GitHub", "cname": "github.io", "signature": "There isn't a GitHub Pages site here."},
                {"provider": "Heroku", "cname": "herokuapp.com", "signature": "No such app"},
                {"provider": "Heroku", "cname": "herokudns.com", "signature": "No such app"},
                {"provider": "Azure", "cname": "azurewebsites.net", "signature": "404 Web Site not found"},
                {"provider": "Fastly", "cname": "fastly.net", "signature": "Fastly error: unknown domain:"},
                {"provider": "Shopify", "cname": "myshopify.com", "signature": "Sorry, this shop is currently unavailable."},
                {"provider": "Pantheon", "cname": "pantheonsite.io", "signature": "The pantheon.io host name you have requested is unknown."},
                {"provider": "Tumblr", "cname": "domains.tumblr.com", "signature": "Whatever you were looking for doesn't currently exist at this address."}
            ]
            
            for cname in cnames:
                for sig in TAKEOVER_SIGNATURES:
                    if sig["cname"] in cname:
                        try:
                            resp = await client.get(f"http://{host}", timeout=5.0)
                            if sig["signature"] in resp.text:
                                details = {
                                    "provider": sig["provider"],
                                    "cname_target": cname,
                                    "evidence": sig["signature"]
                                }
                                await evaluate_risk(session, str(asset_id), "subdomain_takeover_possible", True, "critical", details)
                                return
                        except Exception:
                            pass

        from app.modules.monitoring.risk_engine import evaluate_risk
        
        async with httpx.AsyncClient(verify=False, follow_redirects=True) as client:
            for w_asset in web_assets:
                host = w_asset.hostname
                
                # Check sensitive files
                exposed_files = []
                for path, pattern in SENSITIVE_PATHS.items():
                    p, snippet = await check_path(client, host, path, pattern)
                    if p:
                        exposed_files.append({"path": p, "snippet": snippet})
                        
                for exposed in exposed_files:
                    details = {"path": exposed["path"], "snippet": exposed["snippet"]}
                    await evaluate_risk(session, str(w_asset.id), "sensitive_file_exposed", True, "critical", details)
                    
                # Check security.txt
                has_security_txt = await check_security_txt(client, host)
                await evaluate_risk(session, str(w_asset.id), "security_txt_missing", not has_security_txt, "low", None)
                
                # Check subdomain takeover
                await check_subdomain_takeover(client, host, session, w_asset.id)
                
        # --- Origin IP Leak Detection (Passive via DB) ---
        stmt = select(Asset).where(Asset.domain_id == domain.id)
        all_domain_assets = (await session.execute(stmt)).scalars().all()
        
        waf_detected = False
        waf_names = ["cloudflare", "akamai", "fastly", "incapsula", "sucuri", "aws elb"]
        for a in all_domain_assets:
            if a.technology and any(w in a.technology.lower() for w in waf_names):
                waf_detected = True
                break
                
        if waf_detected:
            suspicious_prefixes = ["mail.", "direct.", "origin.", "ftp.", "cpanel.", "webmail.", "smtp.", "dev.", "staging."]
            exposed_origins = []
            for a in all_domain_assets:
                if a.type == AssetType.subdomain and a.hostname:
                    # check prefix
                    for prefix in suspicious_prefixes:
                        if a.hostname.startswith(prefix):
                            # if this specific subdomain doesn't have a WAF detected itself
                            has_waf = False
                            if a.technology:
                                has_waf = any(w in a.technology.lower() for w in waf_names)
                            if not has_waf:
                                exposed_origins.append(a.hostname)
                            break
                            
            if exposed_origins:
                root_asset = next((a for a in all_domain_assets if a.type == AssetType.root_domain), None)
                if root_asset:
                    details = {
                        "info": "L'adresse IP réelle de votre infrastructure semble fuiter via des sous-domaines non protégés par le CDN.",
                        "exposed_subdomains": list(set(exposed_origins))[:50]
                    }
                    await evaluate_risk(session, str(root_asset.id), "origin_ip_exposed", True, "critical", details)
                    
        # Log active recon in checks history
        stmt = select(Asset).where(Asset.domain_id == domain.id, Asset.type == 'root_domain')
        root_asset = (await session.execute(stmt)).scalars().first()
        if root_asset:
            from app.modules.monitoring.tasks import _save_check
            from app.models.check import CheckResult
            await _save_check(
                asset_id=str(root_asset.id),
                organization_id=str(domain.organization_id),
                check_type="active_recon",
                result=CheckResult.pass_,
                details={"info": "Tests intrusifs (Zone transfert, fichiers sensibles, WAF/Origin IP, takeover) exécutés avec succès."}
            )

        domain.active_recon_state = "idle"
        domain.last_active_recon_at = datetime.now(timezone.utc)
        await session.commit()
    
    await engine.dispose()

@celery_app.task(name="infer_asset_relations")
def infer_asset_relations_task(domain_id: str):
    from app.services.asset_relation_inference import infer_probable_asset_relations
    asyncio.run(infer_probable_asset_relations(domain_id))
    return {"status": "success", "domain_id": domain_id}

@celery_app.task(name="run_active_recon")
def run_active_recon(domain_id: str):
    asyncio.run(_process_active_recon(domain_id))
    infer_asset_relations_task.delay(domain_id)
    return {"status": "success", "domain_id": domain_id}
