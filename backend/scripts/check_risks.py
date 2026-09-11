import asyncio
import sys
import os
from sqlalchemy import select

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.risk import Risk

async def check():
    async with AsyncSessionLocal() as db:
        stmt = select(Risk).where(Risk.rule_key == 'typosquatting_detected')
        risks = (await db.execute(stmt)).scalars().all()
        for r in risks:
            if r.details and r.details.get('squatted_domain') == 'azunlx.ma':
                await db.delete(r)
        await db.commit()
        print("Cleaned up mock risk.")
            
if __name__ == "__main__":
    asyncio.run(check())
