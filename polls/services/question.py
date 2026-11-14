from typing import Any

from polls.models import AnswerOption, Question


class QuestionServices:
    @staticmethod
    def bulk_create_questions(
        user,
        questions_data: list[dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        """Create fresh question rows for one poll; never reuse another poll's rows."""
        created_questions = []

        for question_data in questions_data or []:
            question = Question.objects.create(
                created_by=user,
                name=question_data["name"],
                description=question_data.get("description", ""),
            )
            options = [
                AnswerOption(
                    question=question,
                    name=option_data["name"],
                    order=option_data["order"],
                )
                for option_data in question_data["options"]
            ]
            AnswerOption.objects.bulk_create(options)

            # Re-query instead of relying on backend-specific bulk_create PK return.
            saved_options = AnswerOption.objects.filter(
                question=question
            ).order_by("order", "id")

            created_questions.append({
                "id": question.pk,
                "name": question.name,
                "description": question.description,
                "options": [
                    {"id": option.pk, "name": option.name, "order": option.order}
                    for option in saved_options
                ],
            })

        return created_questions
