import json
import logging
import hashlib
from abc import ABC, abstractmethod
from typing import Any, Optional, Dict
import redis.asyncio as aioredis
from app.config import settings

logger = logging.getLogger(__name__)

class BaseConnector(ABC):
    name: str = "base"
    ttl_seconds: int = 3600
    circuit_breaker_ttl: int = 900 # 15 mins
    max_failures: int = 3
    
    def __init__(self):
        self.redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        
    async def fetch(self, target: str) -> Optional[Dict[str, Any]]:
        # 1. Check Circuit Breaker
        cb_key = f"circuit_breaker:{self.name}"
        failures_key = f"circuit_failures:{self.name}"
        
        is_open = await self.redis.get(cb_key)
        if is_open:
            logger.warning(f"Circuit breaker open for {self.name}. Skipping {target}.")
            return None
            
        # 2. Check Cache
        cache_key = f"threat_intel_cache:{self.name}:{hashlib.sha256(target.encode()).hexdigest()}"
        cached = await self.redis.get(cache_key)
        if cached:
            return json.loads(cached)
            
        # 3. Perform Fetch
        try:
            result = await self._do_fetch(target)
            if result is not None:
                await self.redis.set(cache_key, json.dumps(result), ex=self.ttl_seconds)
                # Reset failures on success
                await self.redis.delete(failures_key)
            return result
            
        except Exception as e:
            logger.error(f"Error fetching from {self.name} for {target}: {e}")
            # Increment failures
            failures = await self.redis.incr(failures_key)
            if failures >= self.max_failures:
                logger.error(f"Max failures reached for {self.name}. Opening circuit breaker for {self.circuit_breaker_ttl}s.")
                await self.redis.set(cb_key, "1", ex=self.circuit_breaker_ttl)
                await self.redis.delete(failures_key)
            return None

    @abstractmethod
    async def _do_fetch(self, target: str) -> Optional[Dict[str, Any]]:
        pass
