from datetime import datetime, timedelta
from typing import TypedDict

from django.db import transaction
from django.db.models import Prefetch, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from common.exceptions import APIValidationError, ConflictError
from polls.models import AnswerOption, Poll, PollQuestion, Question
from polls.services.question import QuestionServices


class NormalizedOptionPayload(TypedDict):
    name: str
    order: int


class NormalizedQuestionPayload(TypedDict):
    name: str
    description: str
    options: list[NormalizedOptionPayload]


class NormalizedPollPayload(TypedDict, total=False):
    name: str
    description: str
    result_visibility: Poll.ResultVisibility
    starts_at: datetime
    ends_at: datetime
    questions: list[NormalizedQuestionPayload] | None


class PollServices:
    @staticmethod
    def get_visible_polls_queryset(*, user):
        """Return the polls the user may view, without serializer-specific loading."""
        is_admin = bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or getattr(user, "role", None) in ("admin", "superadmin")
            )
        )
        if is_admin:
            queryset = Poll.objects.all()
        else:
            queryset = Poll.objects.filter(
                Q(created_by=user)
                | Q(status__in=[Poll.Status.IN_PROGRESS, Poll.Status.COMPLETED])
            )

        return queryset

    @staticmethod
    def get_accessible_polls_queryset(*, user, action):
        """Return polls visible to a user, optimized for the requested action."""
        queryset = PollServices.get_visible_polls_queryset(user=user)
        queryset = queryset.select_related("created_by")
        if action in {"retrieve", "detailed_list", "update", "partial_update"}:
            poll_questions = (
                PollQuestion.objects
                .select_related("question")
                .prefetch_related(
                    Prefetch(
                        "question__answer_options",
                        queryset=AnswerOption.objects.order_by("order", "id"),
                    )
                )
                .order_by("order", "id")
            )
            queryset = queryset.prefetch_related(
                Prefetch("poll_questions", queryset=poll_questions)
            )
        return queryset

    @staticmethod
    def can_manage_poll(*, poll, user):
        if not user or not user.is_authenticated:
            return False

        is_superadmin = user.is_superuser or user.role == "superadmin"
        is_owner = poll.created_by_id == user.pk
        return poll.status == Poll.Status.DRAFT and (is_superadmin or is_owner)

    @staticmethod
    def _parse_datetime(value, field, fallback):
        if value in (None, ""):
            return fallback
        parsed = value if isinstance(value, datetime) else parse_datetime(str(value))
        if parsed is None:
            raise APIValidationError({field: "Enter a valid ISO-8601 date/time."})
        if timezone.is_naive(parsed):
            parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
        return parsed

    @staticmethod
    def validate_and_normalize_payload(
        poll_data: dict,
        *,
        existing_poll: Poll | None = None,
    ) -> NormalizedPollPayload:
        if not isinstance(poll_data, dict):
            raise APIValidationError({"poll": "The poll payload must be an object."})

        name = poll_data.get("name", existing_poll.name if existing_poll else None)
        if not isinstance(name, str) or not name.strip():
            raise APIValidationError({"name": "A poll name is required."})
        name = name.strip()
        if len(name) > 100:
            raise APIValidationError({"name": "Poll names may contain at most 100 characters."})

        duplicate_names = Poll.objects.filter(name__iexact=name)
        if existing_poll:
            duplicate_names = duplicate_names.exclude(pk=existing_poll.pk)
        if duplicate_names.exists():
            raise APIValidationError({"name": "A poll with this name already exists."})

        description = poll_data.get(
            "description",
            existing_poll.description if existing_poll else "",
        )
        if not isinstance(description, str):
            raise APIValidationError({"description": "Description must be a string."})

        visibility = poll_data.get(
            "result_visibility",
            existing_poll.result_visibility if existing_poll else Poll.ResultVisibility.AFTER_SUBMISSION,
        )
        allowed_visibility = {choice for choice, _label in Poll.ResultVisibility.choices}
        if visibility not in allowed_visibility:
            raise APIValidationError({"result_visibility": "Invalid choice value."})

        default_start = existing_poll.starts_at if existing_poll else timezone.now()
        default_end = existing_poll.ends_at if existing_poll else default_start + timedelta(days=1)
        starts_at = PollServices._parse_datetime(
            poll_data.get("starts_at"), "starts_at", default_start
        )
        ends_at = PollServices._parse_datetime(
            poll_data.get("ends_at"), "ends_at", default_end
        )

        # Draft polls must always have a future starting time,
        # both when first created and when an existing draft is edited.
        if starts_at <= timezone.now():
            raise APIValidationError({
                "starts_at": "Poll starting time must be in the future."
            })

        if ends_at <= starts_at:
            raise APIValidationError({"ends_at": "End time must be after start time."})

        questions_data = poll_data.get("questions")
        if questions_data is not None and not isinstance(questions_data, list):
            raise APIValidationError({"questions": "Questions must be a list."})

        normalized_questions = None
        if questions_data is not None:
            normalized_questions = []
            seen_question_names = set()

            for q_index, question_data in enumerate(questions_data):
                if not isinstance(question_data, dict):
                    raise APIValidationError({"questions": {q_index: "Each question must be an object."}})
                question_name = question_data.get("name")
                if not isinstance(question_name, str) or not question_name.strip():
                    raise APIValidationError({"questions": {q_index: "A question name is required."}})
                question_name = question_name.strip()
                if len(question_name) > 255:
                    raise APIValidationError({"questions": {q_index: "Question names may contain at most 255 characters."}})
                normalized_name = question_name.casefold()
                if normalized_name in seen_question_names:
                    raise APIValidationError({"questions": {q_index: "Question names must be unique within a poll."}})
                seen_question_names.add(normalized_name)

                question_description = question_data.get("description", "")
                if not isinstance(question_description, str):
                    raise APIValidationError({"questions": {q_index: "Question description must be a string."}})

                options_data = question_data.get("options")
                if not isinstance(options_data, list) or len(options_data) < 2:
                    raise APIValidationError({"questions": {q_index: "Each question must have at least two answer options."}})


                normalized_options = []
                seen_options = set()
                for option_index, option_data in enumerate(options_data):
                    if not isinstance(option_data, dict):
                        raise APIValidationError({"questions": {q_index: {"options": {option_index: "Each option must be an object."}}}})
                    option_name = option_data.get("name")
                    if not isinstance(option_name, str) or not option_name.strip():
                        raise APIValidationError({"questions": {q_index: {"options": {option_index: "An option name is required."}}}})
                    option_name = option_name.strip()
                    if len(option_name) > 255:
                        raise APIValidationError({"questions": {q_index: {"options": {option_index: "Option names may contain at most 255 characters."}}}})
                    if option_name.casefold() in seen_options:
                        raise APIValidationError({"questions": {q_index: {"options": {option_index: "Option names must be unique within a question."}}}})
                    seen_options.add(option_name.casefold())
                    order = option_data.get("order", option_index + 1)
                    if isinstance(order, bool) or not isinstance(order, int) or order < 1:
                        raise APIValidationError({"questions": {q_index: {"options": {option_index: "Option order must be a positive integer."}}}})
                    normalized_options.append({"name": option_name, "order": order})

                normalized_questions.append({
                    "name": question_name,
                    "description": question_description.strip(),
                    "options": normalized_options,
                })

        return {
            "name": name,
            "description": description.strip(),
            "result_visibility": visibility,
            "starts_at": starts_at,
            "ends_at": ends_at,
            "questions": normalized_questions,
        }

    @staticmethod
    def _replace_questions(poll: Poll, user, questions_data):
        previous_question_ids = list(
            PollQuestion.objects.filter(poll=poll).values_list("question_id", flat=True)
        )
        PollQuestion.objects.filter(poll=poll).delete()
        # Old shared rows are deleted only if no other poll still references them.
        Question.objects.filter(
            pk__in=previous_question_ids,
            poll_questions__isnull=True,
        ).delete()

        created_questions = QuestionServices.bulk_create_questions(
            user=user,
            questions_data=questions_data or [],
        )
        PollQuestion.objects.bulk_create([
            PollQuestion(poll=poll, question_id=item["id"], order=index)
            for index, item in enumerate(created_questions)
        ])
        return created_questions

    @staticmethod
    @transaction.atomic
    def mega_poll(poll_data: dict, user=None) -> Poll:
        normalized = PollServices.validate_and_normalize_payload(poll_data)
        poll = Poll.objects.create(
            created_by=user,
            name=normalized["name"],
            description=normalized["description"],
            status=Poll.Status.DRAFT,
            result_visibility=normalized["result_visibility"],
            starts_at=normalized["starts_at"],
            ends_at=normalized["ends_at"],
        )
        poll.questions_data = PollServices._replace_questions(
            poll, user, normalized["questions"] or []
        )
        return poll

    @staticmethod
    def _questions_match_existing(poll: Poll, questions_data: list[dict]) -> bool:
        """Return True when submitted questions/options are unchanged.

        This lets an owner/admin edit poll metadata after voting has started
        without deleting PollQuestion or Vote records.
        """
        existing_links = list(
            poll.poll_questions
            .select_related("question")
            .prefetch_related("question__answer_options")
            .order_by("order", "id")
        )

        if len(existing_links) != len(questions_data):
            return False

        for link, submitted in zip(existing_links, questions_data):
            question = link.question
            if (
                question.name != submitted["name"]
                or question.description != submitted["description"]
            ):
                return False

            existing_options = list(
                question.answer_options.all().order_by("order", "id")
            )
            submitted_options = submitted["options"]
            if len(existing_options) != len(submitted_options):
                return False

            for existing_option, submitted_option in zip(
                existing_options,
                submitted_options,
            ):
                if (
                    existing_option.name != submitted_option["name"]
                    or existing_option.order != submitted_option["order"]
                ):
                    return False

        return True

    @staticmethod
    @transaction.atomic
    def update_poll(*, poll: Poll, poll_data: dict, user) -> Poll:
        """Only the owner or Superadmin can edit draft polls."""

        poll = Poll.objects.select_for_update().get(pk=poll.pk)

        # Only the poll owner or Superadmin can edit.
        is_superadmin = (
            user.is_superuser
            or getattr(user, "role", None) == "superadmin"
        )

        is_owner = poll.created_by_id == user.pk

        if not (is_owner or is_superadmin):
            raise ConflictError(
                "You do not have permission to edit this poll."
            )

        # Only draft polls are editable.
        if poll.status != Poll.Status.DRAFT:
            raise ConflictError(
                "Only draft polls can be edited. "
                "In-progress and completed polls are read-only."
            )

        # Validate the submitted data.
        normalized = PollServices.validate_and_normalize_payload(
            poll_data,
            existing_poll=poll,
        )

        questions_data = normalized["questions"]

        # Update poll details.
        poll.name = normalized["name"]
        poll.description = normalized["description"]
        poll.result_visibility = normalized["result_visibility"]
        poll.starts_at = normalized["starts_at"]
        poll.ends_at = normalized["ends_at"]

        poll.save(update_fields=[
            "name",
            "description",
            "result_visibility",
            "starts_at",
            "ends_at",
            "updated_at",
        ])

        # Update questions and options if provided.
        if questions_data is not None:
            poll.questions_data = PollServices._replace_questions(
                poll,
                user,
                questions_data,
            )

        return poll

    @staticmethod
    @transaction.atomic
    def extend_poll(*, poll: Poll, new_ends_at) -> Poll:
        raise ConflictError(
            "In-progress polls are read-only and cannot be extended."
        )

    @staticmethod
    def validate_can_publish(*, poll: Poll, user) -> None:
        is_superadmin = (
            user.is_superuser
            or getattr(user, "role", None) == "superadmin"
        )
        if poll.created_by_id != user.pk and not is_superadmin:
            raise ConflictError(
                "Only the poll owner or Superadmin can publish this draft."
            )

        if poll.status != Poll.Status.DRAFT:
            raise ConflictError("Only draft polls can be published.")
        if poll.ends_at <= timezone.now():
            raise APIValidationError({
                "ends_at": "A poll cannot be published after its end time."
            })
        if poll.starts_at >= poll.ends_at:
            raise APIValidationError({
                "ends_at": "End time must be after start time."
            })

        poll_questions = poll.poll_questions.prefetch_related(
            "question__answer_options"
        )
        if not poll_questions.exists():
            raise APIValidationError({
                "questions": "Add at least one question before publishing."
            })
        for poll_question in poll_questions:
            if len(poll_question.question.answer_options.all()) < 2:
                raise APIValidationError({
                    "questions": (
                        f"Question '{poll_question.question.name}' must have "
                        "at least two answer options before publishing."
                    )
                })

    @staticmethod
    @transaction.atomic
    def publish_poll(*, poll: Poll, user) -> Poll:
        poll = Poll.objects.select_for_update().get(pk=poll.pk)
        PollServices.validate_can_publish(poll=poll, user=user)

        poll.status = Poll.Status.IN_PROGRESS
        poll.save(update_fields=["status", "updated_at"])
        return poll

    @staticmethod
    @transaction.atomic
    def close_poll(*, poll: Poll) -> Poll:
        poll = Poll.objects.select_for_update().get(pk=poll.pk)
        if poll.status != Poll.Status.IN_PROGRESS:
            raise ConflictError("Only published polls can be closed.")

        poll.status = Poll.Status.COMPLETED
        poll.save(update_fields=["status", "updated_at"])
        return poll
