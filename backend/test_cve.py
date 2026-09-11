import asyncio
import uuid
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.organization import Organization
from app.models.domain import Domain, DomainStatus
from app.models.asset import Asset, AssetType, AssetStatus
from app.modules.threat_intel.tasks import analyze_cve_nvd

async def test_cve():
    async with AsyncSessionLocal() as session:
        # Get first org
        org = (await session.execute(select(Organization))).scalars().first()
        if not org:
            print("No organization found.")
            return

        # Get or create a domain
        domain = (await session.execute(select(Domain).where(Domain.organization_id == org.id))).scalars().first()
        if not domain:
            print("No domain found.")
            return

        # Create a mock asset with vulnerable technology
        asset_id = uuid.uuid4()
        new_asset = Asset(
            id=asset_id,
            organization_id=org.id,
            domain_id=domain.id,
            type=AssetType.subdomain,
            hostname="test-cve.example.com",
            technology="nginx 1.18.0",
            status=AssetStatus.active
        )
        session.add(new_asset)
        await session.commit()
        
        print(f"Created mock asset {asset_id} with technology 'nginx 1.18.0'. Triggering NVD task...")
        
        # Trigger task
        analyze_cve_nvd.delay(str(asset_id))
        print("Task triggered! Check the dashboard in a few seconds.")

if __name__ == "__main__":
    asyncio.run(test_cve())
