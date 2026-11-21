from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from common.pagination import PollPagination
from polls.serializers.question_serializer import QuestionSuggestionSerializer
from polls.services.question import QuestionServices


class QuestionsList(viewsets.ModelViewSet):

    serializer_class = QuestionSuggestionSerializer
    permission_classes = [IsAuthenticated]

    filter_backends = [filters.SearchFilter]
    search_fields = ["name"]

    pagination_class = PollPagination

    def get_queryset(self):
        queryset = QuestionServices.get_accessible_questions_queryset(
            user=self.request.user
        )
        return queryset