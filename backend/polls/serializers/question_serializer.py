from rest_framework import serializers

from polls.models import Question


class QuestionSuggestionSerializer(serializers.ModelSerializer):

    class Meta:
        model = Question
        fields = ["id", "name"]
        read_only_fields = fields