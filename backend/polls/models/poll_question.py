from django.db import models


class PollQuestion(models.Model):
    poll = models.ForeignKey(
        'Poll',
        on_delete=models.CASCADE,
        related_name='poll_questions'
    )
    question = models.ForeignKey(
        'Question',
        on_delete=models.CASCADE,
        related_name='poll_questions'
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['poll', 'question'],
                name='unique_poll_question'
            ),
        ]

    def __str__(self):
        return (
            f"Poll ID: {self.poll_id or 'No Poll'} | "
            f"Question ID: {self.question_id or 'New'} "
            f"(Order: {self.order})"
        )