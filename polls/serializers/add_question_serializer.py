from rest_framework import serializers
from polls.services.answer_options import AnswerOptionServices


class OptionInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    order = serializers.IntegerField()

class AddQuestionToPollSerializer(serializers.Serializer):
    question_name = serializers.CharField(max_length=255)
    order = serializers.IntegerField(help_text="Position of the question in this poll")
    options = OptionInputSerializer(many=True)

    def save(self, poll, user):
        return AnswerOptionServices.add_question_to_poll(
            poll=poll,
            user=user,
            question_name=self.validated_data["question_name"],
            order=self.validated_data["order"],
            options=self.validated_data["options"],
        )
