from rest_framework import serializers

from auth.serializers.user_serializer import MiniUserSerializer


class VoteCastSerializer(serializers.Serializer):
    polls = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False,
    )

    def _represent_vote(self, vote):
        return {
            "poll_question_id": vote.poll_question_id,
            "question_name": vote.poll_question.question.name,
            "answer_option_id": vote.answer_id,
            "selected_option_name": vote.answer.name,
        }

    def to_representation(self, instance):
        poll_results = []
        for item in instance["polls"]:
            poll = item["poll"]
            poll_results.append({
                "poll": {
                    "id": poll.id,
                    "name": poll.name,
                    "created_by": MiniUserSerializer(poll.created_by).data,
                },
                "votes": [self._represent_vote(vote) for vote in item["votes"]],
            })
        return {"polls": poll_results}

VoteCastResponseSerializer = VoteCastSerializer


# Individual answer, vote count, percentage
class AnswerResultSerializer(serializers.Serializer):
    answer_id = serializers.IntegerField()
    answer = serializers.CharField()
    votes = serializers.IntegerField()
    percentage = serializers.FloatField()

#Question, total votes, its answer results
class PollQuestionResultSerializer(serializers.Serializer):
    poll_question_id = serializers.IntegerField()
    question_id = serializers.IntegerField()
    question = serializers.CharField()
    total_votes = serializers.IntegerField()
    answers = AnswerResultSerializer(many=True)

#Complete poll result
class PollResultSerializer(serializers.Serializer):
    poll_id = serializers.IntegerField()
    poll_name = serializers.CharField()
    status = serializers.CharField()
    result_visibility = serializers.CharField()
    unique_voters = serializers.IntegerField()
    questions = PollQuestionResultSerializer(many=True)

