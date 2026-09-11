import asyncio
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.models.domain import Domain
from app.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    
    async with SessionLocal() as session:
        stmt = select(Domain)
        domains = (await session.execute(stmt)).scalars().all()
        for d in domains:
            d.ownership_verified = True
        await session.commit()
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
