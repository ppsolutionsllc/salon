import os

from celery import Celery

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery("worker", broker=redis_url, backend=redis_url)

celery_app.conf.task_default_queue = "celery"

celery_app.conf.beat_schedule = {
    "poll-outbox-every-15-seconds": {
        "task": "app.worker.tasks.process_outbox",
        "schedule": 15.0,
    },
    "expire-unconfirmed-every-minute": {
        "task": "app.worker.tasks.expire_unconfirmed",
        "schedule": 60.0,
    },
    "enqueue-communications-every-10-minutes": {
        "task": "app.worker.tasks.enqueue_communications",
        "schedule": 600.0,
    },
}

# Ensure task modules are imported so workers register task names.
import app.worker.tasks  # noqa: E402,F401
