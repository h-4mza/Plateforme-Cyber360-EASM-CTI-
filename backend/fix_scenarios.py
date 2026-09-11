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
        asset_id = 'df07422f-34c2-4470-9103-e7d6cf51e5a7'
        asset = (await db.execute(select(Asset).where(Asset.id == asset_id))).scalar_one_or_none()
        if not asset:
            return
            
        risk = Risk(
            id=uuid.uuid4(),
            organization_id=asset.organization_id,
            asset_id=asset.id,
            rule_key='tls_cert_expired',
            status='open',
            severity='critical',
            details={"info": "TLS cert expired."},
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        db.add(risk)
        await db.commit()
        
        await evaluate_organization_scenarios(str(asset.organization_id), db)
        print("Scenarios evaluated!")

asyncio.run(main())
