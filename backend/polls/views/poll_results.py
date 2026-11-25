from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters as drf_filters, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from common.api.responses import success_response
from common.filters import PollFilter
from common.pagination import PollPagination
from polls.permissions import is_admin
from polls.serializers.poll_results import PollResultDetailSerializer
from polls.services.poll_reports import PollReportGenerator
from polls.services.poll_results import PollResultsService


class PollResultsViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Handles:
      - GET /api/poll-results/
      - GET /api/poll-results/{id}/
      - GET /api/poll-results/{id}/export-excel/
      - GET /api/poll-results/{id}/export-pdf/

    Supports comprehensive filtering & searching via query parameters:
      - ?search=<term> (Unified search across poll ID, poll name, creator name, or question name)
      - ?status=in_progress | completed
      - ?result_visibility=live | after_submission | polls_end | restricted
      - ?user_id=<creator_id>
      - ?user_name=<creator_name>
      - ?ordering=-created_at | name | etc.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = PollResultDetailSerializer
    pagination_class = PollPagination

    filter_backends = [
        DjangoFilterBackend,
        drf_filters.SearchFilter,
        drf_filters.OrderingFilter,
    ]
    filterset_class = PollFilter
    search_fields = [
        "id",
        "name",
        "created_by__first_name",
        "created_by__last_name",
        "poll_questions__question__name",
    ]
    ordering_fields = ["id", "name", "created_at", "ends_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return PollResultsService.get_eligible_polls_queryset(
            user=self.request.user,
        )

    def list(self, request, *args, **kwargs):
        """
        GET /api/poll-results/
        Applies filter_backends (filtering, searching, ordering), paginates,
        and computes results using batch ORM optimization.
        """
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            results_data = PollResultsService.compute_results_for_polls(page)
            serializer = self.get_serializer(results_data, many=True)
            return self.get_paginated_response(serializer.data)

        results_data = PollResultsService.compute_results_for_polls(list(queryset))
        serializer = self.get_serializer(results_data, many=True)
        return success_response(
            data=serializer.data,
            message="Poll results retrieved successfully.",
        )

    def retrieve(self, request, *args, **kwargs):
        """
        GET /api/poll-results/{poll_id}/
        Returns complete calculated results for a single poll.
        """
        poll_id = kwargs.get("pk")
        result_data = PollResultsService.get_single_poll_result(
            poll_id=poll_id,
            user=request.user,
        )
        serializer = self.get_serializer(result_data)
        return success_response(
            data=serializer.data,
            message="Poll results retrieved successfully.",
        )

    def _validate_export_access(self, poll_id, user):
        """
        Verify export authorization at the backend:
          - Admin / SuperAdmin: Can export any poll.
          - Regular Client: Can only export their own created polls.
        """
        result_data = PollResultsService.get_single_poll_result(
            poll_id=poll_id,
            user=user,
        )

        creator = result_data.get("created_by")
        creator_id = getattr(creator, "pk", getattr(creator, "id", None))
        if creator_id is None and isinstance(creator, dict):
            creator_id = creator.get("user_id") or creator.get("id")

        if not is_admin(user) and creator_id != user.pk:
            raise PermissionDenied("You are only authorized to export polls created by you.")

        # Serialize result_data so PollReportGenerator gets clean JSON-friendly dicts
        serializer = self.get_serializer(result_data)
        return serializer.data

    @action(detail=True, methods=["get"], url_path="export-excel")
    def export_excel(self, request, pk=None):
        """
        GET /api/poll-results/{id}/export-excel/
        Exports raw tabular poll data formatted with openpyxl.
        """
        data = self._validate_export_access(poll_id=pk, user=request.user)
        excel_stream = PollReportGenerator.generate_excel(data)

        response = HttpResponse(
            excel_stream.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="poll_{pk}_results.xlsx"'
        return response

    @action(detail=True, methods=["get"], url_path="export-pdf")
    def export_pdf(self, request, pk=None):
        """
        GET /api/poll-results/{id}/export-pdf/
        Exports luxury branded visual PDF matching the frontend results page.
        """
        data = self._validate_export_access(poll_id=pk, user=request.user)
        pdf_stream = PollReportGenerator.generate_pdf(data, include_voters=True)

        response = HttpResponse(
            pdf_stream.getvalue(),
            content_type="application/pdf",
        )
        response["Content-Disposition"] = f'attachment; filename="poll_{pk}_report.pdf"'
        return response
