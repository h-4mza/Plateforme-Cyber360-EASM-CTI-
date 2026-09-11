import asyncio
import logging
import sys
import os
from sqlalchemy import select

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.domain import Domain
from app.services.typosquatting_check import check_typosquatting_for_domain

logging.basicConfig(level=logging.INFO)

async def trigger():
    async with AsyncSessionLocal() as db:
        stmt = select(Domain).where(Domain.name == 'azunix.ma')
        domain = (await db.execute(stmt)).scalar_one_or_none()
        if not domain:
            print("Domain azunix.ma not found")
            return
            
        print(f"Triggering check_typosquatting_for_domain for domain {domain.name}")
        await check_typosquatting_for_domain(domain, db)
        print("Done inferring typosquatting.")
        
if __name__ == "__main__":
    asyncio.run(trigger())
