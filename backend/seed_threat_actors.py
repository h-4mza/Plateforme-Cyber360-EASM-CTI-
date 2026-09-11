import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.threat_landscape import ThreatActorProfile
from datetime import date

# Fetch database URL from environment or use a default suitable for docker
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://cyber360:secret123@postgres:5432/cyber360")

engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

THREAT_ACTORS = [
    {
        "name": "MuddyWater (Iran)",
        "targeted_sectors": ["gouvernement", "telecom", "energie"],
        "targeted_regions": ["MA", "MENA", "Middle East"],
        "mitre_techniques": ["T1059", "T1078", "T1105", "T1566", "T1053", "T1543"],
        "last_known_activity": date(2023, 10, 1),
        "source_ref": "MITRE ATT&CK Group G0069",
        "description": "Groupe lié aux services de renseignement iraniens (MOIS), ciblant activement les pays de la région MENA pour des opérations d'espionnage et d'exfiltration de données."
    },
    {
        "name": "APT34 / OilRig (Iran)",
        "targeted_sectors": ["banque_finance", "gouvernement", "energie", "telecom"],
        "targeted_regions": ["MA", "MENA"],
        "mitre_techniques": ["T1566", "T1059", "T1083", "T1105", "T1071"],
        "last_known_activity": date(2023, 8, 15),
        "source_ref": "MITRE ATT&CK Group G0049",
        "description": "Groupe de cyberespionnage iranien, cible des secteurs clés (finance, énergie) au Moyen-Orient et Afrique du Nord pour le compte du gouvernement iranien."
    },
    {
        "name": "Lazarus Group (Corée du Nord)",
        "targeted_sectors": ["banque_finance", "crypto", "gouvernement"],
        "targeted_regions": ["MA", "MENA", "Global"],
        "mitre_techniques": ["T1566", "T1189", "T1055", "T1059", "T1027", "T1105", "T1486"],
        "last_known_activity": date(2024, 1, 10),
        "source_ref": "MITRE ATT&CK Group G0032",
        "description": "Cybercriminels parrainés par la Corée du Nord, principalement motivés par le gain financier (vols bancaires, cryptomonnaies, ransomwares), ciblant globalement y compris le Maroc."
    },
    {
        "name": "UNC1151 / Ghostwriter (Biélorussie/Russie)",
        "targeted_sectors": ["gouvernement", "media", "defense"],
        "targeted_regions": ["MA", "Europe", "MENA"],
        "mitre_techniques": ["T1566", "T1114", "T1078", "T1059", "T1105"],
        "last_known_activity": date(2023, 11, 20),
        "source_ref": "Mandiant Threat Research",
        "description": "Acteur de menace menant des campagnes de désinformation et d'espionnage, ayant mené des opérations d'ingénierie sociale ciblant parfois des personnalités politiques en Afrique du Nord."
    },
    {
        "name": "TA505 (Russie - Cybercrime)",
        "targeted_sectors": ["banque_finance", "hotellerie_tourisme", "industrie"],
        "targeted_regions": ["MA", "Global", "MENA"],
        "mitre_techniques": ["T1566", "T1059", "T1055", "T1105", "T1027", "T1486"],
        "last_known_activity": date(2023, 12, 5),
        "source_ref": "MITRE ATT&CK Group G0092",
        "description": "Groupe cybercriminel prolifique connu pour la distribution massive de ransomwares (Clop) et de trojans bancaires (Dridex), touchant régulièrement des entreprises marocaines."
    },
    {
        "name": "Desert Falcons",
        "targeted_sectors": ["gouvernement", "media", "finance", "industrie"],
        "targeted_regions": ["MA", "MENA"],
        "mitre_techniques": ["T1566", "T1059", "T1056", "T1012", "T1113"],
        "last_known_activity": date(2022, 6, 15),
        "source_ref": "Kaspersky Research",
        "description": "Premier groupe de cyberespionnage arabophone connu, ciblant massivement les pays du Moyen-Orient et d'Afrique du Nord (dont le Maroc), utilisant souvent du spear-phishing."
    },
    {
        "name": "WIRTE Group",
        "targeted_sectors": ["gouvernement", "diplomatie", "finance", "technologie"],
        "targeted_regions": ["MA", "MENA"],
        "mitre_techniques": ["T1566", "T1059.005", "T1059.003", "T1053", "T1071"],
        "last_known_activity": date(2023, 9, 30),
        "source_ref": "Kaspersky APT Intelligence",
        "description": "Groupe soupçonné d'avoir des liens avec Gaza Cybergang, ciblant principalement les gouvernements et institutions diplomatiques au Moyen-Orient et en Afrique."
    }
]

async def seed_threat_actors():
    async with async_session() as session:
        for actor_data in THREAT_ACTORS:
            result = await session.execute(
                select(ThreatActorProfile).where(ThreatActorProfile.name == actor_data["name"])
            )
            existing = result.scalar_one_or_none()
            if not existing:
                actor = ThreatActorProfile(**actor_data)
                session.add(actor)
                print(f"Added Threat Actor: {actor.name}")
            else:
                for key, value in actor_data.items():
                    setattr(existing, key, value)
                print(f"Updated Threat Actor: {existing.name}")
        await session.commit()
        print("Done seeding threat actors.")

if __name__ == "__main__":
    asyncio.run(seed_threat_actors())
