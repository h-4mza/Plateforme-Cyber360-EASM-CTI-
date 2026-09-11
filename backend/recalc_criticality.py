import asyncio
import json
import os
import sys

# Setup path to import app modules
sys.path.append(os.path.dirname(__file__))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.config import settings
from app.models.asset import Asset

RULES_PATH = os.path.join(os.path.dirname(__file__), "criticality_rules.json")

def load_rules():
    with open(RULES_PATH, 'r') as f:
        return json.load(f)

async def main():
    print("Chargement des règles de criticité...")
    rules = load_rules()
    sensitive_keywords = rules.get("sensitive_keywords", [])
    sensitive_techs = rules.get("sensitive_technologies", [])
    
    print(f"Mots-clés sensibles: {len(sensitive_keywords)}")
    print(f"Technologies sensibles: {len(sensitive_techs)}")
    
    print("Connexion à la base de données...")
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    
    updated_count = 0
    
    async with SessionLocal() as session:
        stmt = select(Asset)
        result = await session.execute(stmt)
        assets = result.scalars().all()
        
        print(f"Évaluation de {len(assets)} actifs...")
        
        for asset in assets:
            should_be_high = False
            reason = ""
            
            # Check hostname
            if asset.hostname:
                for keyword in sensitive_keywords:
                    if keyword in asset.hostname.lower():
                        should_be_high = True
                        reason = f"Hostname contient le mot-clé sensible: {keyword}"
                        break
                        
            # Check technology
            if not should_be_high and asset.technology:
                for tech in sensitive_techs:
                    if tech.lower() in asset.technology.lower():
                        should_be_high = True
                        reason = f"Technologie sensible détectée: {tech}"
                        break
                        
            if should_be_high and asset.criticality != "high":
                asset.criticality = "high"
                updated_count += 1
                print(f"[MAJ] {asset.hostname or asset.ip_address} -> HAUTE ({reason})")
                
        if updated_count > 0:
            print("Sauvegarde des modifications en base de données...")
            await session.commit()
            
    await engine.dispose()
    print(f"Terminé ! {updated_count} actifs ont vu leur criticité mise à jour vers Haute.")

if __name__ == "__main__":
    asyncio.run(main())
