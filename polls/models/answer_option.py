from django.db import models


class AnswerOption(models.Model):
    question = models.ForeignKey(
        "Question",
        on_delete=models.CASCADE,
        related_name="answer_options",
    )
    name = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["question", "name"],
                name="unique_option_per_question",
            )
        ]
        ordering = ["order", "id"]

    def __str__(self):
        return self.name
