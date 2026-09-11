import asyncio
import logging
import sys
import os
from sqlalchemy import select

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.domain import Domain
from app.modules.monitoring.scenario_engine import evaluate_organization_scenarios

logging.basicConfig(level=logging.INFO)

async def trigger():
    async with AsyncSessionLocal() as db:
        stmt = select(Domain).where(Domain.name == 'azunix.ma')
        domain = (await db.execute(stmt)).scalar_one_or_none()
        if not domain:
            print("Domain azunix.ma not found")
            return
            
        print(f"Triggering evaluate_organization_scenarios for org {domain.organization_id}")
        await evaluate_organization_scenarios(domain.organization_id, db)
        print("Done")

if __name__ == "__main__":
    asyncio.run(trigger())
