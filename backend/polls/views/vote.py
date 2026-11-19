from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from common.api.responses import success_response
from polls.models import Poll
from polls.serializers.vote import (
    PollResultSerializer,
    VoteCastSerializer,
)
from polls.services.vote import VoteServices


class VoteCastView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = VoteCastSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Send the complete multi-poll submission to the voting service.
        result = VoteServices.cast_votes(
            user=request.user,
            polls_data=serializer.validated_data["polls"],
        )

        response_serializer = VoteCastSerializer(instance=result)

        return success_response(
            data=response_serializer.data,
            message="Votes submitted successfully.",
            status_code=status.HTTP_200_OK,
        )


class VoteResultView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        poll_id = request.query_params.get("poll", "").strip()

        if not poll_id or not poll_id.isdecimal() or int(poll_id) < 1:
            raise ValidationError({
                "poll": "A valid positive poll ID is required."
            })

        # Draft polls do not have public voting results.
        poll = get_object_or_404(
            Poll.objects.filter(
                status__in=[
                    Poll.Status.IN_PROGRESS,
                    Poll.Status.COMPLETED,
                ]
            ),
            pk=int(poll_id),
        )

        # Apply the poll's configured result visibility.
        if not VoteServices.can_view_results(
            poll=poll,
            user=request.user,
        ):
            raise PermissionDenied(
                "Poll results are not available yet."
            )

        result_data = VoteServices.get_poll_results(poll=poll)
        serializer = PollResultSerializer(instance=result_data)

        return success_response(
            data=serializer.data,
            message="Poll results retrieved successfully.",
            status_code=status.HTTP_200_OK,
        )
