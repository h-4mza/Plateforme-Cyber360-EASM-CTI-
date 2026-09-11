import httpx
import ipaddress
from typing import Optional, Dict, Any
from app.config import settings
from .base import BaseConnector

class AbuseIPDBConnector(BaseConnector):
    name = "abuseipdb"
    ttl_seconds = 86400  # 24h
    
    async def _do_fetch(self, target: str) -> Optional[Dict[str, Any]]:
        if not settings.ABUSEIPDB_API_KEY:
            return None
            
        try:
            ipaddress.ip_address(target)
        except ValueError:
            return None # AbuseIPDB only supports IPs
            
        headers = {
            "Key": settings.ABUSEIPDB_API_KEY,
            "Accept": "application/json"
        }
        params = {
            "ipAddress": target,
            "maxAgeInDays": "90"
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://api.abuseipdb.com/api/v2/check", headers=headers, params=params, timeout=10.0)
            if resp.status_code == 200:
                data = resp.json().get("data", {})
                return {
                    "abuseConfidenceScore": data.get("abuseConfidenceScore", 0),
                    "totalReports": data.get("totalReports", 0),
                    "raw": data
                }
            else:
                resp.raise_for_status()
