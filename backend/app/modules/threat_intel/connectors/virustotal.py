import httpx
import ipaddress
from typing import Optional, Dict, Any
from app.config import settings
from .base import BaseConnector

class VirusTotalConnector(BaseConnector):
    name = "virustotal"
    ttl_seconds = 86400  # 24h
    
    async def _do_fetch(self, target: str) -> Optional[Dict[str, Any]]:
        if not settings.VIRUSTOTAL_API_KEY:
            return None
            
        try:
            ipaddress.ip_address(target)
            endpoint = f"https://www.virustotal.com/api/v3/ip_addresses/{target}"
        except ValueError:
            endpoint = f"https://www.virustotal.com/api/v3/domains/{target}"
            
        headers = {
            "x-apikey": settings.VIRUSTOTAL_API_KEY
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(endpoint, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                data = resp.json()
                attrs = data.get("data", {}).get("attributes", {})
                last_analysis = attrs.get("last_analysis_stats", {})
                malicious = last_analysis.get("malicious", 0)
                categories = attrs.get("categories", {})
                return {
                    "malicious_votes": malicious,
                    "categories": categories,
                    "raw": attrs
                }
            elif resp.status_code == 404:
                return {"malicious_votes": 0, "categories": {}} # Not found on VT = clean
            else:
                resp.raise_for_status()
