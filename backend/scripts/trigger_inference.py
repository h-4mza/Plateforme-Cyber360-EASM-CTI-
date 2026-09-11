import asyncio
import logging
import sys
import os
from sqlalchemy import select, text

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.domain import Domain
from app.services.asset_relation_inference import infer_probable_asset_relations

logging.basicConfig(level=logging.INFO)

async def trigger():
    async with AsyncSessionLocal() as db:
        stmt = select(Domain).where(Domain.name == 'azunix.ma')
        domain = (await db.execute(stmt)).scalar_one_or_none()
        if not domain:
            print("Domain azunix.ma not found")
            return
            
        print(f"Triggering infer_probable_asset_relations for domain {domain.id}")
        await infer_probable_asset_relations(str(domain.id))
        print("Done inferring.")
        
        q1 = text("""
            SELECT relation_type, COUNT(*) as c
            FROM asset_relations 
            WHERE source_asset_id IN (
                SELECT id FROM assets WHERE domain_id = :dom_id
            )
            GROUP BY relation_type;
        """)
        res1 = await db.execute(q1, {"dom_id": domain.id})
        print("AssetRelations created:")
        for row in res1.fetchall():
            print(f"- Type: {row[0]}, Count: {row[1]}")

if __name__ == "__main__":
    asyncio.run(trigger())
