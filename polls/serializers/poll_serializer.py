from rest_framework import serializers

from auth.serializers.user_serializer import MiniUserSerializer
from polls.models import AnswerOption, Poll, PollQuestion, Vote


class AnswerOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnswerOption
        fields = ["id", "name", "order"]
        read_only_fields = fields


class PollQuestionSerializer(serializers.ModelSerializer):
    options = AnswerOptionSerializer(
        source="question.answer_options",
        many=True,
        read_only=True,
    )
    question_name = serializers.CharField(source="question.name", read_only=True)
    question_description = serializers.CharField(
        source="question.description",
        read_only=True,
    )
    my_vote = serializers.SerializerMethodField()

    def get_my_vote(self, obj):
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return None

        vote = (
            Vote.objects
            .filter(user=request.user, poll_question=obj)
            .select_related("answer")
            .first()
        )
        if vote is None:
            return None

        return {
            "answer_option_id": vote.answer_id,
            "selected_option_name": vote.answer.name,
        }

    class Meta:
        model = PollQuestion
        fields = [
            "id",
            "question_name",
            "question_description",
            "order",
            "options",
            "my_vote",
        ]
        read_only_fields = fields


class PollDetailSerializer(serializers.ModelSerializer):
    questions = PollQuestionSerializer(
        source="poll_questions",
        many=True,
        read_only=True,
    )
    created_by = MiniUserSerializer(read_only=True)
    can_manage = serializers.SerializerMethodField()

    def get_can_manage(self, obj):
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return False
        is_superadmin = (
            request.user.is_superuser
            or request.user.role == "superadmin"
        )
        is_owner = obj.created_by_id == request.user.pk
        return obj.status == Poll.Status.DRAFT and (is_superadmin or is_owner)

    # Keep ISO-8601 representations so clients can safely edit and resubmit dates.
    starts_at = serializers.DateTimeField(required=False)
    ends_at = serializers.DateTimeField(required=False)

    class Meta:
        model = Poll
        fields = [
            "id",
            "name",
            "description",
            "status",
            "result_visibility",
            "created_by",
            "can_manage",
            "starts_at",
            "ends_at",
            "questions",
        ]
        read_only_fields = ["id", "created_by", "can_manage", "status", "questions"]

    def validate(self, attrs):
        starts_at = attrs.get(
            "starts_at",
            self.instance.starts_at if self.instance else None,
        )
        ends_at = attrs.get(
            "ends_at",
            self.instance.ends_at if self.instance else None,
        )
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({
                "ends_at": "End time must be after start time."
            })
        return attrs


class PollListSerializer(serializers.ModelSerializer):
    created_by = MiniUserSerializer(read_only=True)
    can_manage = serializers.SerializerMethodField()

    def get_can_manage(self, obj):
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return False
        is_superadmin = (
            request.user.is_superuser
            or request.user.role == "superadmin"
        )
        is_owner = obj.created_by_id == request.user.pk
        return obj.status == Poll.Status.DRAFT and (is_superadmin or is_owner)

    class Meta:
        model = Poll
        fields = ["id", "name", "status", "created_by", "can_manage"]
        read_only_fields = fields


class PollExtendSerializer(serializers.Serializer):
    ends_at = serializers.DateTimeField()
