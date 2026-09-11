# Discovery Module

The Discovery module is responsible for continuous external attack surface mapping.

It performs:
- Subdomain enumeration using multiple data sources
- DNS resolution and record extraction
- Certificate transparency log analysis
- Asset deduplication and lifecycle management

All discovery jobs run asynchronously using Celery and store identified infrastructure in the `Asset` model.
