import logging
from app.config import settings

logger = logging.getLogger(__name__)

def check_threat_intel_keys():
    if not settings.VIRUSTOTAL_API_KEY:
        logger.warning("VIRUSTOTAL_API_KEY is not set. VirusTotal integration will be disabled.")
    if not settings.ABUSEIPDB_API_KEY:
        logger.warning("ABUSEIPDB_API_KEY is not set. AbuseIPDB integration will be disabled.")
    if not settings.NVD_API_KEY:
        logger.warning("NVD_API_KEY is not set. NVD integration will be disabled.")
