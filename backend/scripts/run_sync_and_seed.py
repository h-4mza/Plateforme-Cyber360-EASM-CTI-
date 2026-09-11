import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.attack_sync import sync_mitre_attack_data
from scripts.seed_attack_demo import seed_demo_data

async def main():
    print("Running MITRE ATT&CK Sync...")
    try:
        stats = await sync_mitre_attack_data()
        print(f"Sync complete! Stats: {stats}")
    except Exception as e:
        print(f"Sync failed: {e}")
        return

    print("Running Demo Seeding...")
    try:
        await seed_demo_data()
        print("Demo seeding complete!")
    except Exception as e:
        print(f"Seeding failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
