import logging
import asyncio
from typing import Any, Optional, Dict
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from pymisp import PyMISP
from app.config import settings
from app.database import AsyncSessionLocal
from app.models.misp_indicator import MispIndicator
from app.modules.threat_intel.connectors.base import BaseConnector

logger = logging.getLogger(__name__)

class MISPConnector(BaseConnector):
    name: str = "misp"
    
    def __init__(self):
        super().__init__()
        self.misp_url = settings.MISP_URL
        self.misp_key = settings.MISP_API_KEY

    async def _do_fetch(self, target: str) -> Optional[Dict[str, Any]]:
        # For MISP, we sync in bulk and query locally.
        # Real-time fetch against MISP isn't implemented.
        return None

    async def sync_misp_attributes(self):
        """
        Synchronizes recent attributes from MISP and upserts them into misp_indicators table.
        """
        if not self.misp_url or not self.misp_key:
            logger.warning("MISP URL or API key not configured. Skipping MISP sync.")
            return

        cb_key = f"circuit_breaker:{self.name}"
        failures_key = f"circuit_failures:{self.name}"
        
        is_open = await self.redis.get(cb_key)
        if is_open:
            logger.warning(f"Circuit breaker open for {self.name}. Skipping sync.")
            return

        try:
            logger.info("Starting MISP attributes sync...")
            result = await asyncio.to_thread(self._sync_fetch_attributes)
            await self._upsert_attributes(result)
            
            await self.redis.delete(failures_key)
            logger.info(f"Successfully synced {len(result)} attributes from MISP.")
            
        except Exception as e:
            logger.error(f"Error syncing MISP attributes: {e}")
            failures = await self.redis.incr(failures_key)
            if failures >= self.max_failures:
                logger.error(f"Max failures reached for {self.name}. Opening circuit breaker for {self.circuit_breaker_ttl}s.")
                await self.redis.set(cb_key, "1", ex=self.circuit_breaker_ttl)
                await self.redis.delete(failures_key)

    def _sync_fetch_attributes(self) -> list:
        # PyMISP is synchronous
        misp = PyMISP(self.misp_url, self.misp_key, False)
        
        types = ['ip-dst', 'ip-src', 'domain', 'hostname', 'url', 'md5', 'sha1', 'sha256']
        date_from = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
        
        # We fetch published attributes, requesting tags to map threat_level
        response = misp.search(
            controller='attributes',
            type_attribute=types,
            published=True,
            last=date_from,
            pythonify=False
        )
        
        if 'Attribute' in response:
            return response['Attribute']
        return []

    async def _upsert_attributes(self, attributes: list):
        if not attributes:
            return
            
        async with AsyncSessionLocal() as session:
            for attr in attributes:
                attr_id = str(attr.get('id'))
                event_id = str(attr.get('event_id'))
                attr_type = attr.get('type')
                value = attr.get('value')
                
                # Parse first_seen or timestamp
                first_seen = attr.get('first_seen') or attr.get('timestamp')
                dt_first_seen = None
                if first_seen:
                    try:
                        if isinstance(first_seen, str) and first_seen.isdigit():
                            dt_first_seen = datetime.fromtimestamp(int(first_seen), tz=timezone.utc)
                        elif isinstance(first_seen, str):
                            dt_first_seen = datetime.fromisoformat(first_seen.replace('Z', '+00:00'))
                        elif isinstance(first_seen, int):
                            dt_first_seen = datetime.fromtimestamp(first_seen, tz=timezone.utc)
                    except Exception:
                        pass
                
                # Extract tags and threat level
                tags = attr.get('Tag', [])
                threat_level = None
                event_tags = []
                for tag in tags:
                    tag_name = tag.get('name', '')
                    event_tags.append(tag_name)
                    if tag_name.startswith('misp:threat-level='):
                        threat_level = tag_name.replace('misp:threat-level=', '').strip('"\'')
                
                # Map indicator type
                if attr_type in ['ip-src', 'ip-dst']:
                    indicator_type = 'ip'
                elif attr_type in ['domain', 'hostname']:
                    indicator_type = 'domain'
                elif attr_type == 'url':
                    indicator_type = 'url'
                else:
                    indicator_type = 'hash'
                
                stmt = select(MispIndicator).where(MispIndicator.misp_attribute_id == attr_id)
                existing = (await session.execute(stmt)).scalar_one_or_none()
                
                if existing:
                    existing.value = value
                    existing.threat_level = threat_level
                    existing.event_tags = event_tags
                    existing.last_synced_at = datetime.now(timezone.utc)
                else:
                    new_ind = MispIndicator(
                        misp_attribute_id=attr_id,
                        misp_event_id=event_id,
                        indicator_type=indicator_type,
                        value=value,
                        threat_level=threat_level,
                        event_tags=event_tags,
                        first_seen=dt_first_seen,
                        last_synced_at=datetime.now(timezone.utc)
                    )
                    session.add(new_ind)
                    
            await session.commit()
