import asyncio
import logging
import sys
import os
from sqlalchemy import select, text
from pprint import pprint

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("diagnostic")

async def run_diagnostic():
    async with AsyncSessionLocal() as db:
        # 1. AssetRelations for azunix.ma
        print("=== 1. AssetRelations for azunix.ma ===")
        q1 = text("""
            SELECT relation_type, COUNT(*) as c
            FROM asset_relations 
            WHERE source_asset_id IN (
                SELECT id FROM assets WHERE domain_id = (SELECT id FROM domains WHERE name = 'azunix.ma')
            )
            GROUP BY relation_type;
        """)
        res1 = await db.execute(q1)
        for row in res1.fetchall():
            print(f"- Type: {row[0]}, Count: {row[1]}")

        # 4. Risks for azunix.ma vs Rule Keys
        print("\n=== 4. Risk check_types for azunix.ma ===")
        q4 = text("""
            SELECT DISTINCT rule_key 
            FROM risks 
            WHERE asset_id IN (
                SELECT id FROM assets WHERE domain_id = (SELECT id FROM domains WHERE name = 'azunix.ma')
            )
            AND status = 'open';
        """)
        # Wait, the field in Risk model is `rule_key`, not `check_type`. I'll query `rule_key`.
        res4 = await db.execute(q4)
        risk_rule_keys = [r[0] for r in res4.fetchall()]
        print(f"Open Risks rule_keys for azunix.ma: {risk_rule_keys}")
        
        # Load scenarios to see if any match stage=1
        import app.modules.monitoring.scenario_engine as se
        scenarios = se.load_attack_scenarios()
        matching_scenarios = []
        for key, sc in scenarios.items():
            if 'kill_chain' in sc and len(sc['kill_chain']) > 0:
                stage1_rules = sc['kill_chain'][0]['rule_keys']
                # Intersection
                if set(risk_rule_keys).intersection(set(stage1_rules)):
                    matching_scenarios.append(key)
        
        print(f"Scenarios triggered by these rule_keys at Stage 1: {matching_scenarios}")

if __name__ == "__main__":
    asyncio.run(run_diagnostic())
