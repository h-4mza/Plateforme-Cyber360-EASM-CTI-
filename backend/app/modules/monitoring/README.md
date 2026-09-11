# Monitoring Module

The Monitoring module handles automated security checks across the attack surface.

It is responsible for checking configurations and finding vulnerabilities:
- Email security checks (SPF, DKIM, DMARC)
- Web security checks (DNSSEC, TLS/SSL certificates, HTTP security headers)
- Port scanning and service fingerprinting

It runs periodic jobs via Celery Beat, storing the results in the `Check` model, which are then passed to the Risk Engine.
