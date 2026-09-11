import os
import aiohttp
import logging
from typing import Optional, Dict, Any
from app.modules.threat_intel.connectors.base import BaseConnector
from app.config import settings

logger = logging.getLogger(__name__)

class ShodanConnector(BaseConnector):
    name: str = "shodan"
    ttl_seconds: int = 7 * 24 * 3600 # 7 days cache

    def __init__(self):
        super().__init__()
        self.api_key = getattr(settings, 'SHODAN_API_KEY', None) or os.environ.get('SHODAN_API_KEY')
        
    async def _do_fetch(self, target: str) -> Optional[Dict[str, Any]]:
        if not self.api_key:
            logger.info("Shodan API key not found. Skipping Shodan enrichment.")
            return None
            
        url = f"https://api.shodan.io/shodan/host/{target}?key={self.api_key}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    return await response.json()
                elif response.status == 404:
                    # No data found for this IP
                    return {"ports": [], "data": [], "vulns": []}
                else:
                    logger.warning(f"Shodan API returned status {response.status} for {target}")
                    return None
