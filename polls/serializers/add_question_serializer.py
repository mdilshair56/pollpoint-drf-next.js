from rest_framework import serializers
from django.db import transaction
from polls.models.question import Question
from polls.models.poll_question import PollQuestion
# from polls.services.question import QuestionServices
from polls.services.answer_options import AnswerOptionServices


class OptionInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    order = serializers.IntegerField()

class AddQuestionToPollSerializer(serializers.Serializer):
    question_name = serializers.CharField(max_length=255)
    order = serializers.IntegerField(help_text="Position of the question in this poll")
    options = OptionInputSerializer(many=True)

    @transaction.atomic
    def save(self, poll, user):
        question = Question.objects.create(
            name=self.validated_data["question_name"],
            created_by=user,
        )
        options_payload = [
            {
                "question_id": question.pk,
                "name": option["name"],
                "order": option["order"],
            }
            for option in self.validated_data["options"]
        ]
        if len(options_payload) < 2:
            raise serializers.ValidationError({
                "options": "At least two answer options are required."
            })
        AnswerOptionServices.bulk_create_options(
            options_payload=options_payload
        )
        PollQuestion.objects.create(
            poll=poll,
            question=question,
            order=self.validated_data["order"],
        )
        return question