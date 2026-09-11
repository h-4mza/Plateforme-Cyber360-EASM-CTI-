import asyncio
import uuid
from app.database import AsyncSessionLocal
from app.models.asset import Asset
from sqlalchemy import select
from app.modules.monitoring.tasks import check_ports, check_tls, check_http_headers

async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Asset))
        assets = result.scalars().all()
        
        for asset in assets:
            print(f"Triggering checks for {asset.hostname or asset.ip_address} (ID: {asset.id})...")
            check_ports.delay(str(asset.id))
            if asset.hostname:
                check_tls.delay(str(asset.id))
                check_http_headers.delay(str(asset.id))

if __name__ == "__main__":
    asyncio.run(main())
