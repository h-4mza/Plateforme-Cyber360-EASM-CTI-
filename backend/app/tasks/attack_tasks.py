import asyncio
from app.celery_app import celery_app
from app.services.attack_sync import sync_mitre_attack_data

@celery_app.task(name="sync_mitre_attack")
def sync_mitre_attack():
    asyncio.run(sync_mitre_attack_data())
