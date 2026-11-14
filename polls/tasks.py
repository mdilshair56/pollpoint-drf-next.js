from celery import shared_task
from django.utils import timezone

from polls.models import Poll


@shared_task
def complete_expired_polls():
    """Close published polls whose configured end time has passed."""
    now = timezone.now()
    return Poll.objects.filter(
        status=Poll.Status.IN_PROGRESS,
        ends_at__lte=now,
    ).update(
        status=Poll.Status.COMPLETED,
        updated_at=now,
    )
