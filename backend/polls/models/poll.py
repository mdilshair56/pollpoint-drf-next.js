from django.conf import settings
from django.db import models
from django.db.models.functions import Lower

from common.time_model import TimeFramedModel


class Poll(TimeFramedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED = "completed", "Completed"

    class ResultVisibility(models.TextChoices):
        LIVE = "live", "Live"
        AFTER_SUBMISSION = "after_submission", "After Submission"
        POLLS_END = "polls_end", "Polls End"
        RESTRICTED = "restricted", "Restricted"

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_polls",
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    result_visibility = models.CharField(
        max_length=30,
        choices=ResultVisibility.choices,
        default=ResultVisibility.AFTER_SUBMISSION,
    )
    email_report_on_completion = models.BooleanField(default=False)
    email_report_excel = models.BooleanField(default=False)
    email_report_pdf = models.BooleanField(default=False)
    report_email_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Poll"
        verbose_name_plural = "Polls"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                name="unique_poll_name_ci",
            )
        ]

        indexes = [
            models.Index(
                fields=["status", "result_visibility", "-created_at"],
                name="idx_poll_status_vis_created",
            ),
        ]

    def __str__(self):
        return self.name
