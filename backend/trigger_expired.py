import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.asset import Asset, AssetType, AssetStatus
from app.models.domain import Domain
from app.modules.monitoring.tasks import check_tls

async def main():
    async with AsyncSessionLocal() as db:
        domain = (await db.execute(select(Domain).where(Domain.name == 'badssl.com'))).scalar_one_or_none()
        if not domain:
            print("Domain not found")
            return
            
        asset = Asset(
            organization_id=domain.organization_id,
            domain_id=domain.id,
            hostname="expired.badssl.com",
            type=AssetType.subdomain,
            status=AssetStatus.active
        )
        db.add(asset)
        await db.commit()
        await db.refresh(asset)
        print(f"Added {asset.hostname}, id: {asset.id}")
        check_tls.delay(str(asset.id))
        print("Triggered check_tls")

asyncio.run(main())
