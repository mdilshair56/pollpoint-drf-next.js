from types import SimpleNamespace
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory

from common.exceptions import APIValidationError, ConflictError
from polls.models import AnswerOption, Poll, PollQuestion, Question
from polls.serializers.poll_serializer import (
    PollDetailSerializer,
    PollListSerializer,
)
from polls.services.answer_options import AnswerOptionServices
from polls.services.poll import PollServices


User = get_user_model()


class AddQuestionToPollServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="poll-owner",
            email="poll-owner@example.com",
            password="test-password",
        )
        self.poll = Poll.objects.create(
            created_by=self.user,
            name="Service test poll",
        )

    def test_add_question_creates_question_options_and_poll_link(self):
        question = AnswerOptionServices.add_question_to_poll(
            poll=self.poll,
            user=self.user,
            question_name="Favorite color?",
            order=2,
            options=[
                {"name": "Blue", "order": 0},
                {"name": "Green", "order": 1},
            ],
        )

        self.assertEqual(question.created_by, self.user)
        self.assertEqual(question.name, "Favorite color?")
        self.assertEqual(
            list(question.answer_options.order_by("order").values_list("name", flat=True)),
            ["Blue", "Green"],
        )
        self.assertTrue(
            PollQuestion.objects.filter(
                poll=self.poll,
                question=question,
                order=2,
            ).exists()
        )
        self.assertEqual(AnswerOption.objects.filter(question=question).count(), 2)

    def test_add_question_requires_two_options_and_creates_nothing(self):
        with self.assertRaises(APIValidationError):
            AnswerOptionServices.add_question_to_poll(
                poll=self.poll,
                user=self.user,
                question_name="One option?",
                order=0,
                options=[{"name": "Only one", "order": 0}],
            )

        self.assertEqual(Question.objects.count(), 0)
        self.assertEqual(PollQuestion.objects.count(), 0)


class CanManagePollTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="manage-owner",
            email="manage-owner@example.com",
            password="test-password",
        )
        self.other_user = User.objects.create_user(
            username="manage-other",
            email="manage-other@example.com",
            password="test-password",
        )
        self.poll = Poll.objects.create(
            created_by=self.owner,
            name="Manage test poll",
            status=Poll.Status.DRAFT,
        )
        self.factory = APIRequestFactory()

    def test_service_allows_owner_and_superadmin_only_while_draft(self):
        self.assertTrue(PollServices.can_manage_poll(poll=self.poll, user=self.owner))
        self.assertFalse(PollServices.can_manage_poll(poll=self.poll, user=self.other_user))

        admin = User.objects.create_superuser(
            username="manage-admin",
            email="manage-admin@example.com",
            password="test-password",
        )
        self.assertTrue(PollServices.can_manage_poll(poll=self.poll, user=admin))

        self.poll.status = Poll.Status.IN_PROGRESS
        self.assertFalse(PollServices.can_manage_poll(poll=self.poll, user=self.owner))
        self.assertFalse(PollServices.can_manage_poll(poll=self.poll, user=admin))

    def test_both_poll_serializers_use_shared_manage_rule(self):
        request = self.factory.get("/")
        request.user = self.owner
        context = {"request": request}

        self.assertTrue(PollListSerializer(self.poll, context=context).data["can_manage"])
        self.assertTrue(PollDetailSerializer(self.poll, context=context).data["can_manage"])

        request.user = self.other_user
        self.assertFalse(PollListSerializer(self.poll, context=context).data["can_manage"])
        self.assertFalse(PollDetailSerializer(self.poll, context=context).data["can_manage"])

        anonymous_request = SimpleNamespace(user=SimpleNamespace(is_authenticated=False))
        anonymous_context = {"request": anonymous_request}
        self.assertFalse(
            PollListSerializer(self.poll, context=anonymous_context).data["can_manage"]
        )


class PollPublishValidationTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="publish-owner",
            email="publish-owner@example.com",
            password="test-password",
        )
        self.other_user = User.objects.create_user(
            username="publish-other",
            email="publish-other@example.com",
            password="test-password",
        )
        now = timezone.now()
        self.poll = Poll.objects.create(
            created_by=self.owner,
            name="Publish validation poll",
            starts_at=now,
            ends_at=now + timedelta(days=1),
        )

    def _add_question(self, *, option_count):
        question = Question.objects.create(
            name="Publish question",
            created_by=self.owner,
        )
        PollQuestion.objects.create(poll=self.poll, question=question)
        AnswerOption.objects.bulk_create([
            AnswerOption(question=question, name=f"Option {index}", order=index)
            for index in range(option_count)
        ])

    def test_valid_poll_passes_publish_validation(self):
        self._add_question(option_count=2)

        PollServices.validate_can_publish(poll=self.poll, user=self.owner)

    def test_non_owner_cannot_publish(self):
        with self.assertRaises(ConflictError):
            PollServices.validate_can_publish(poll=self.poll, user=self.other_user)

    def test_poll_without_questions_cannot_be_published(self):
        with self.assertRaises(APIValidationError):
            PollServices.validate_can_publish(poll=self.poll, user=self.owner)

    def test_question_requires_two_options_before_publish(self):
        self._add_question(option_count=1)

        with self.assertRaises(APIValidationError):
            PollServices.validate_can_publish(poll=self.poll, user=self.owner)

    def test_completed_or_expired_draft_cannot_be_published(self):
        self._add_question(option_count=2)
        self.poll.ends_at = timezone.now() - timedelta(seconds=1)
        self.poll.save(update_fields=["ends_at"])

        with self.assertRaises(APIValidationError):
            PollServices.validate_can_publish(poll=self.poll, user=self.owner)

        self.poll.ends_at = timezone.now() + timedelta(days=1)
        self.poll.status = Poll.Status.COMPLETED
        self.poll.save(update_fields=["ends_at", "status"])
        with self.assertRaises(ConflictError):
            PollServices.validate_can_publish(poll=self.poll, user=self.owner)
