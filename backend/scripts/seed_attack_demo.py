import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.organization import Organization
from app.models.domain import Domain
from app.models.asset import Asset
from app.models.risk import Risk, RiskStatus, risk_technique_map
from app.models.attack import AttackGroup, AttackTechnique

async def seed_demo_data():
    async with AsyncSessionLocal() as session:
        # 1. Organization & Domain
        org = await session.scalar(select(Organization).limit(1))
        if not org:
            org = Organization(name="Demo Corp")
            session.add(org)
            await session.flush()
            
        domain = await session.scalar(select(Domain).where(Domain.organization_id == org.id).limit(1))
        if not domain:
            domain = Domain(name="demo-target.local", organization_id=org.id)
            session.add(domain)
            await session.flush()
            
        asset = await session.scalar(select(Asset).where(Asset.domain_id == domain.id).limit(1))
        if not asset:
            asset = Asset(name="app.demo-target.local", type="subdomain", domain_id=domain.id, organization_id=org.id)
            session.add(asset)
            await session.flush()
            
        print(f"Using Domain: {domain.name} (ID: {domain.id})")

        # 2. Add realistic risks with techniques
        demo_risks = [
            ("spf_missing", "critical", "T1566.002"),
            ("dmarc_missing", "high", "T1566"), 
            ("admin_port_exposed", "critical", "T1021.001"),
            ("eol_software_detected", "high", "T1190"),
            ("tls_old_version", "medium", "T1557"),
            ("tls_cert_expired", "high", "T1553.002"),
            ("csp_missing", "low", "T1189"),
            ("mail_port_exposed_without_tls", "high", "T1110"),
            ("http_no_redirect", "low", "T1557"),
            ("dnssec_missing", "medium", "T1584.001"),
            ("x_frame_options_missing", "low", "T1557"),
            ("caa_missing", "low", "T1553.002"),
            ("tls_rpt_missing", "low", "T1590"),
            ("mta_sts_missing", "low", "T1566"),
            ("dkim_missing", "high", "T1566"),
        ]
        
        now = datetime.now(timezone.utc)
        
        for rule_key, severity, tech_id in demo_risks:
            risk = Risk(
                organization_id=org.id,
                asset_id=asset.id,
                rule_key=rule_key,
                severity=severity,
                status=RiskStatus.open,
                first_detected_at=now,
                last_seen_at=now,
                details={"demo": True, "message": "Seeded for demo purposes"}
            )
            session.add(risk)
            await session.flush()
            
            from sqlalchemy.dialects.postgresql import insert
            stmt = insert(risk_technique_map).values(risk_id=risk.id, technique_id=tech_id).on_conflict_do_nothing()
            await session.execute(stmt)
            print(f"Created active risk for {rule_key} -> {tech_id}")
            
        # 3. Simulate Threat Groups Activity (Optional - they should be added by sync)
        apt29 = await session.scalar(select(AttackGroup).where(AttackGroup.id == "G0016"))
        if apt29:
            print(f"Verified APT29 exists with name {apt29.name}.")
        else:
            print("Warning: Run /api/attack/sync first to populate MITRE data.")

        await session.commit()
        print("Demo seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_demo_data())
