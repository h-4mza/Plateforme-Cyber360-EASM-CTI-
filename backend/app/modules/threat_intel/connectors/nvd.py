import httpx
import logging
from typing import Any, Dict, Optional
from app.modules.threat_intel.connectors.base import BaseConnector

logger = logging.getLogger(__name__)

class NVDConnector(BaseConnector):
    name = "nvd"
    ttl_seconds = 7 * 24 * 3600  # 7 days

    async def _do_fetch(self, target: str) -> Optional[Dict[str, Any]]:
        # target format: "software_name version"
        url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
        params = {
            "keywordSearch": target,
            "resultsPerPage": 20
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, params=params)
                
                if resp.status_code == 403:
                    logger.warning("NVD API rate limited")
                    return None
                    
                resp.raise_for_status()
                data = resp.json()
                
                vulnerabilities = data.get("vulnerabilities", [])
                
                if not vulnerabilities:
                    return {"cve_count": 0, "max_cvss": 0.0, "top_cves": []}
                
                highest_cvss = 0.0
                cves_found = []
                
                for vuln in vulnerabilities:
                    cve = vuln.get("cve", {})
                    cve_id = cve.get("id")
                    
                    # Extract highest CVSS score from V31, V30, or V2
                    metrics = cve.get("metrics", {})
                    cvss = 0.0
                    
                    if "cvssMetricV31" in metrics:
                        cvss = metrics["cvssMetricV31"][0]["cvssData"]["baseScore"]
                    elif "cvssMetricV30" in metrics:
                        cvss = metrics["cvssMetricV30"][0]["cvssData"]["baseScore"]
                    elif "cvssMetricV2" in metrics:
                        cvss = metrics["cvssMetricV2"][0]["cvssData"]["baseScore"]
                        
                    if cvss > highest_cvss:
                        highest_cvss = cvss
                        
                    if cve_id:
                        cves_found.append({"id": cve_id, "score": cvss})
                
                # Sort by score descending and take top 3
                cves_found.sort(key=lambda x: x["score"], reverse=True)
                top_cves = [c["id"] for c in cves_found[:3]]
                
                return {
                    "cve_count": len(vulnerabilities), # Note: this is capped at resultsPerPage (20) but sufficient for MVP
                    "max_cvss": highest_cvss,
                    "top_cves": top_cves
                }
                
        except Exception as e:
            logger.error(f"Error calling NVD API for {target}: {e}")
            raise
