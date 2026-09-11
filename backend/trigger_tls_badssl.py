import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.asset import Asset, AssetType, AssetStatus
from app.models.domain import Domain
from app.modules.monitoring.tasks import check_tls

async def main():
    subs = ['wrong.host.badssl.com', 'self-signed.badssl.com', 'untrusted-root.badssl.com']
    async with AsyncSessionLocal() as db:
        domain = (await db.execute(select(Domain).where(Domain.name == 'badssl.com'))).scalar_one_or_none()
        if not domain:
            return
            
        for sub in subs:
            existing = (await db.execute(select(Asset).where(Asset.hostname == sub))).scalar_one_or_none()
            if not existing:
                asset = Asset(
                    organization_id=domain.organization_id,
                    domain_id=domain.id,
                    hostname=sub,
                    type=AssetType.subdomain,
                    status=AssetStatus.active
                )
                db.add(asset)
                await db.commit()
                await db.refresh(asset)
            else:
                asset = existing
            check_tls.delay(str(asset.id))
            print(f"Triggered check_tls for {sub}")

asyncio.run(main())
