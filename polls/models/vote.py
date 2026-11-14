from django.conf import settings
from django.db import models

from common.time_model import TimeStampedModel


class Vote(TimeStampedModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="votes",
    )
    poll_question = models.ForeignKey(
        "PollQuestion",
        on_delete=models.CASCADE,
        related_name="votes",
    )
    answer = models.ForeignKey(
        "AnswerOption",
        on_delete=models.CASCADE,
        related_name="votes",
    )

    class Meta:
        verbose_name = "Vote"
        verbose_name_plural = "Votes"
        ordering = ["-created_at"]
        constraints = [
            # Enforce one stored vote per user and poll-specific question.
            models.UniqueConstraint(
                fields=["user", "poll_question"],
                name="unique_user_vote_per_question",
            )
        ]

    def __str__(self):
        return f"Vote by {self.user} on PollQuestion #{self.poll_question_id}"
