import asyncio
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.asset import Asset
from app.models.risk import Risk
from app.modules.monitoring.scenario_engine import evaluate_organization_scenarios

async def main():
    async with AsyncSessionLocal() as db:
        asset = (await db.execute(select(Asset).where(Asset.hostname == 'expired.badssl.com'))).scalars().first()
        if not asset:
            print("Asset not found")
            return
            
        risk = Risk(
            id=uuid.uuid4(),
            organization_id=asset.organization_id,
            asset_id=asset.id,
            rule_key='subdomain_takeover_possible',
            status='open',
            severity='critical',
            details={"info": "Subdomain takeover is possible on this asset."},
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(risk)
        await db.commit()
        print(f"Added subdomain_takeover_possible risk to {asset.hostname}")
        
        await evaluate_organization_scenarios(str(asset.organization_id), db)
        print("Scenarios evaluated!")

asyncio.run(main())
