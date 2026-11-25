from rest_framework import serializers

from auth.serializers.user_serializer import MiniUserSerializer


class AnswerOptionResultSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    voters = MiniUserSerializer(many=True)


class QuestionResultSerializer(serializers.Serializer):
    poll_question_id = serializers.IntegerField()
    question_id = serializers.IntegerField()
    Question_name = serializers.CharField()
    answer_options = AnswerOptionResultSerializer(many=True)


class PollResultDetailSerializer(serializers.Serializer):
    poll_id = serializers.IntegerField()
    poll_name = serializers.CharField()
    description = serializers.CharField(allow_blank=True, required=False)
    created_by = MiniUserSerializer()
    created_at = serializers.DateTimeField()
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField()
    status = serializers.CharField()
    result_visibility = serializers.CharField()
    questions = QuestionResultSerializer(many=True)
