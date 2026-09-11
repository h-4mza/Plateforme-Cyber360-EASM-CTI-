import httpx
import logging
from typing import Optional, Dict, Any
from app.config import settings
from .base import BaseConnector, ThreatIntelResult

logger = logging.getLogger(__name__)

class HaveIBeenPwnedConnector(BaseConnector):
    def __init__(self):
        super().__init__(name="hibp", cache_ttl=86400) # Cache for 24 hours
        
    async def _do_fetch(self, target: str) -> Optional[Dict[str, Any]]:
        # Target here is expected to be a domain name
        api_key = getattr(settings, "HIBP_API_KEY", None)
        if not api_key:
            logger.warning("HIBP_API_KEY non configurée. Le connecteur HIBP est désactivé.")
            return None
            
        url = f"https://haveibeenpwned.com/api/v3/breaches?domain={target}"
        headers = {
            "hibp-api-key": api_key,
            "user-agent": "Cyber360-Monitoring"
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    breaches = resp.json()
                    if not breaches:
                        return None
                        
                    # Aggregate results
                    total_accounts = sum(b.get("PwnCount", 0) for b in breaches)
                    breach_names = [b.get("Name") for b in breaches]
                    latest_breach_date = max(b.get("BreachDate", "") for b in breaches)
                    
                    return {
                        "total_exposed_accounts": total_accounts,
                        "breach_names": breach_names,
                        "latest_breach_date": latest_breach_date,
                        "breaches_details": breaches
                    }
                elif resp.status_code == 404:
                    return None
                else:
                    logger.error(f"HIBP API erreur: {resp.status_code} - {resp.text}")
                    return None
        except Exception as e:
            logger.error(f"Erreur lors de l'interrogation de HIBP: {e}")
            raise
