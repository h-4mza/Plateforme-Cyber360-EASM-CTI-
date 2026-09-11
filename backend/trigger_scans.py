import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.asset import Asset
from app.modules.monitoring.tasks import check_ports, check_tls, check_http_headers

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Asset).where(Asset.hostname.in_(['scanme.nmap.org', 'badssl.com'])))
        assets = result.scalars().all()
        for a in assets:
            print(f"Triggering for {a.hostname}")
            check_ports.delay(str(a.id))
            check_tls.delay(str(a.id))
            check_http_headers.delay(str(a.id))

asyncio.run(main())
