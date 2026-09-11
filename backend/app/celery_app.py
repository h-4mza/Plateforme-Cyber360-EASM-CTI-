from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "cyber360",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.autodiscover_tasks([
    'app.modules.discovery',
    'app.modules.monitoring',
    'app.modules.threat_intel',
    'app.tasks'
])

@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    # Monitoring quotidien existant
    sender.add_periodic_task(
        crontab(hour=2, minute=0),
        'check_all_assets',
    )
    sender.add_periodic_task(
        crontab(hour=1, minute=0),
        'snapshot_daily_scores',
    )
    # Brand protection
    sender.add_periodic_task(
        crontab(hour=3, minute=0),
        'monitor_certificate_transparency',
    )
    sender.add_periodic_task(
        crontab(hour=4, minute=0, day_of_week=0),
        'run_typosquatting_check',
    )
    sender.add_periodic_task(
        crontab(hour=5, minute=0, day_of_week=1), # Weekly on Monday
        'run_data_leak_check',
    )
    sender.add_periodic_task(
        crontab(hour=3, minute=0, day_of_week=0), # Weekly on Sunday
        'compute_sector_benchmarks',
    )
    sender.add_periodic_task(
        crontab(hour=3, minute=0, day_of_week=0), # MITRE sync on Sunday 3 AM
        'sync_mitre_attack',
    )

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "hourly-asset-security-checks": {
            "task": "dispatch_due_asset_checks",
            "schedule": 3600.0, # Every hour
        },
        "hourly-misp-sync": {
            "task": "sync_misp_attributes_task",
            "schedule": 3600.0, # Every hour
        }
    }
)
