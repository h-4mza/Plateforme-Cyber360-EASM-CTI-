import asyncio
from sqlalchemy import select
from app.database import async_session_maker
from app.models.attack_scenario import AttackScenarioDetected

async def main():
    async with async_session_maker() as session:
        stmt = select(AttackScenarioDetected).limit(1)
        res = await session.execute(stmt)
        scenario = res.scalar_one_or_none()
        if scenario:
            print("attack_path:", scenario.attack_path)
            print("risk_ids:", scenario.risk_ids)
        else:
            print("No scenarios found.")

if __name__ == "__main__":
    asyncio.run(main())
