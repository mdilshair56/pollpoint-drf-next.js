from django.db.models import Case, F, IntegerField, Q, Value, When
from django.db.models.functions import Lower

from common.exceptions import APIValidationError
from polls.models import AnswerOption, Question
from polls.permissions import is_admin
from polls.services.poll import PollServices


class SuggestionService:
    SEARCH_TYPES = ("poll", "question", "answer_option")

    @staticmethod
    def _name_matches(queryset, query):
        """Filter by name and rank prefix matches before contained matches."""
        return (
            queryset
            .filter(name__icontains=query)
            .annotate(
                match_priority=Case(
                    When(name__istartswith=query, then=Value(0)),
                    default=Value(1),
                    output_field=IntegerField(),
                )
            )
            .order_by("match_priority", Lower("name"), "id")
        )

    @staticmethod
    def _visible_questions_queryset(*, user):
        if is_admin(user):
            return Question.objects.all()

        visible_polls = PollServices.get_visible_polls_queryset(user=user)
        return Question.objects.filter(
            Q(created_by=user) | Q(poll_questions__poll__in=visible_polls)
        ).distinct()

    @staticmethod
    def search_polls(*, user, query):
        polls = PollServices.get_visible_polls_queryset(user=user)
        return list(
            SuggestionService._name_matches(polls, query)
            .values("id", "name")[:10]
        )

    @staticmethod
    def search_questions(*, user, query):
        questions = SuggestionService._visible_questions_queryset(user=user)
        return list(
            SuggestionService._name_matches(questions, query)
            .values("id", "name")[:10]
        )

    @staticmethod
    def search_answer_options(*, user, query):
        if is_admin(user):
            answer_options = AnswerOption.objects.all()
        else:
            visible_questions = SuggestionService._visible_questions_queryset(
                user=user
            )
            answer_options = AnswerOption.objects.filter(
                question__in=visible_questions
            )

        return list(
            SuggestionService._name_matches(answer_options, query)
            .values("id", "name", question_name=F("question__name"))[:10]
        )

    @classmethod
    def validate_query_params(cls, *, search_type, query):
        errors = {}
        if not search_type:
            errors["type"] = ["This field is required."]
        elif search_type not in cls.SEARCH_TYPES:
            errors["type"] = [f'"{search_type}" is not a valid choice.']

        if query is None or query == "":
            errors["q"] = ["This field is required."]
        elif isinstance(query, str) and not query.strip():
            errors["q"] = ["This field may not be blank."]

        if errors:
            raise APIValidationError(errors)

        return search_type, str(query).strip()

    @classmethod
    def search(cls, *, user, search_type, query):
        search_type, query = cls.validate_query_params(
            search_type=search_type, query=query
        )
        if len(query) < 2:
            return []

        search_operations = {
            "poll": cls.search_polls,
            "question": cls.search_questions,
            "answer_option": cls.search_answer_options,
        }
        return search_operations[search_type](user=user, query=query)


PollSuggestionServices = SuggestionService
