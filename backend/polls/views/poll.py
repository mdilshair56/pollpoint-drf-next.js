# from django.db.models import query
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters as drf_filters, status, viewsets
from rest_framework.decorators import action
from common.api.responses import success_response
from common.exceptions import APIValidationError
from common.filters import PollFilter
from common.pagination import PollPagination
from polls.models import Poll, PollQuestion, Question
from polls.permissions import PollObjectPermission
from polls.serializers.poll_serializer import (
    PollDetailSerializer,
    PollListSerializer,
)
from polls.services.poll import PollServices
# from polls.services.suggestion import SuggestionService


class PollViewSet(viewsets.ModelViewSet):
    permission_classes = [PollObjectPermission]
    serializer_class = PollDetailSerializer
    pagination_class = PollPagination

    filter_backends = [
        DjangoFilterBackend,
        drf_filters.SearchFilter,
        drf_filters.OrderingFilter,
    ]
    filterset_class = PollFilter
    search_fields = [
        "name",
        "description"
    ]
    ordering_fields = ["name", "created_at", "starts_at", "ends_at"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return PollListSerializer
        return PollDetailSerializer

    def get_queryset(self):
        return PollServices.get_accessible_polls_queryset(
            user=self.request.user,
            action=self.action,
        )

    # def list(self, request, *args, **kwargs):
    #     search_type = request.query_params.get("suggestion_type")
    #
    #     if search_type:
    #         suggestions = SuggestionService.search(
    #             user=request.user,
    #             search_type=search_type,
    #             query=request.query_params.get("search"),
    #         )
    #
    #         return success_response(
    #             data=suggestions,
    #             message="Suggestions retrieved successfully.",
    #         )
    #
    #     return super().list(request, *args, **kwargs)


    def create(self, request, *args, **kwargs):
        if not isinstance(request.data, dict):
            raise APIValidationError({
                "detail": "Expected a JSON object containing poll details."
            })
        poll = PollServices.mega_poll(request.data, user=request.user)
        return success_response(
            data={
                "id": poll.pk,
                "name": poll.name,
                "description": poll.description,
                "status": poll.status,
                "result_visibility": poll.result_visibility,
                "starts_at": poll.starts_at,
                "ends_at": poll.ends_at,
                "questions": poll.questions_data,
            },
            message="Draft poll created successfully. Publish it when ready.",
            status_code=status.HTTP_201_CREATED,
        )

    def retrieve(self, request, *args, **kwargs):
        poll = self.get_object()
        return success_response(
            data=self.get_serializer(poll).data,
            message="Poll retrieved successfully.",
        )

    def _update_draft(self, request, *, partial):
        poll = self.get_object()
        # Validate supplied dates through DRF's DateTimeFields as well as the service.
        validator = PollDetailSerializer(instance=poll, data=request.data, partial=partial)
        validator.is_valid(raise_exception=True)
        updated = PollServices.update_poll(
            poll=poll,
            poll_data=request.data,
            user=request.user,
        )
        updated = self.get_queryset().get(pk=updated.pk)
        return success_response(
            data=PollDetailSerializer(
                updated,
                context=self.get_serializer_context(),
            ).data,
            message="Poll updated successfully.",
        )

    def update(self, request, *args, **kwargs): #PUT
        return self._update_draft(request, partial=False)

    def partial_update(self, request, *args, **kwargs): #PATCH
        if "status" in request.data:
            if request.data["status"] != Poll.Status.IN_PROGRESS:
                raise APIValidationError({
                    "status": "A draft poll can only be changed to in_progress."
                })

            poll = self.get_object()
            published_poll = PollServices.publish_poll(
                poll=poll,
                user=request.user,
            )
            return success_response(
                data=PollDetailSerializer(
                    self.get_queryset().get(pk=published_poll.pk),
                    context=self.get_serializer_context(),
                ).data,
                message="Poll published successfully.",
            )
        return self._update_draft(request, partial=True)

    # @action(detail=True, methods=["post"], url_path="publish")
    # def publish(self, request, pk=None):
    #     poll = self.get_object()
    #     PollServices.validate_can_publish(poll=poll, user=request.user)
    #
    #     poll.status = Poll.Status.IN_PROGRESS
    #     poll.save(update_fields=["status", "updated_at"])
    #
    #     return success_response(
    #         data=PollDetailSerializer(
    #             self.get_queryset().get(pk=poll.pk),
    #             context=self.get_serializer_context(),
    #         ).data,
    #         message="Poll published successfully.",
    #     )

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        poll = self.get_object()
        closed_poll = PollServices.close_poll(poll=poll)
        return success_response(
            data=PollDetailSerializer(
                self.get_queryset().get(pk=closed_poll.pk),
                context=self.get_serializer_context(),
            ).data,
            message="Poll closed successfully. Voting is no longer accepted.",
        )

    # @action(detail=True, methods=["post"], url_path="extend")
    # def extend(self, request, pk=None):
    #     poll = self.get_object()
    #     serializer = PollExtendSerializer(data=request.data)
    #     serializer.is_valid(raise_exception=True)
    #     extended_poll = PollServices.extend_poll(
    #         poll=poll,
    #         new_ends_at=serializer.validated_data["ends_at"],
    #     )
    #     return success_response(
    #         data=PollDetailSerializer(
    #             self.get_queryset().get(pk=extended_poll.pk),
    #             context=self.get_serializer_context(),
    #         ).data,
    #         message="Poll end date extended successfully.",
    #     )

    def destroy(self, request, *args, **kwargs):
        poll = self.get_object()
        poll_name = poll.name
        question_ids = list(
            PollQuestion.objects.filter(poll=poll).values_list("question_id", flat=True)
        )
        poll.delete()
        # Remove question/option rows that are no longer linked to any poll.
        Question.objects.filter(
            pk__in=question_ids,
            poll_questions__isnull=True,
        ).delete()
        return success_response(
            data={"id": int(kwargs["pk"]), "name": poll_name},
            message="Poll deleted successfully.",
            status_code=status.HTTP_200_OK,
        )

    # @action(detail=False, methods=["get"], url_path="details")
    # def detailed_list(self, request, *args, **kwargs):
    #     queryset = self.filter_queryset(self.get_queryset())
    #     page = self.paginate_queryset(queryset)
    #     serializer = self.get_serializer(page if page is not None else queryset, many=True)
    #     if page is not None:
    #         return self.get_paginated_response(serializer.data)
    #     return success_response(
    #         data=serializer.data,
    #         message="All poll details retrieved successfully.",
    #     )
