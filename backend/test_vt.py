import asyncio
from app.modules.threat_intel.connectors.virustotal import VirusTotalConnector
from app.config import settings
import json

async def main():
    if not settings.VIRUSTOTAL_API_KEY:
        print("Erreur : La clé VIRUSTOTAL_API_KEY n'est pas définie dans le fichier .env.")
        print("Veuillez l'ajouter avant de lancer ce test.")
        return
        
    print("Clé API détectée ! Initialisation du test...")
    vt = VirusTotalConnector()
    
    # Test avec un domaine bénin connu
    target_domain = "example.com"
    print(f"\n--- Interrogation pour le domaine : {target_domain} ---")
    try:
        res = await vt.fetch(target_domain)
        print(f"Nombre de détections malveillantes : {res.get('malicious_votes') if res else 'N/A'}")
    except Exception as e:
        print(f"Erreur lors de l'appel pour {target_domain}: {e}")
        
    # Attend 20 secondes pour respecter le quota agressif (4 par minute = 1 toutes les 15s max)
    print("\nAttente de 16 secondes pour respecter la limite de 4 requêtes / minute...")
    await asyncio.sleep(16)
    
    # Test avec une IP
    target_ip = "8.8.8.8"
    print(f"\n--- Interrogation pour l'IP : {target_ip} ---")
    try:
        res = await vt.fetch(target_ip)
        print(f"Nombre de détections malveillantes : {res.get('malicious_votes') if res else 'N/A'}")
    except Exception as e:
        print(f"Erreur lors de l'appel pour {target_ip}: {e}")

if __name__ == "__main__":
    asyncio.run(main())
