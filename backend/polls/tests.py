from types import SimpleNamespace
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory

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


class PollSuggestionApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="suggestion-owner",
            email="suggestion-owner@example.com",
            password="test-password",
        )
        self.viewer = User.objects.create_user(
            username="suggestion-viewer",
            email="suggestion-viewer@example.com",
            password="test-password",
        )
        self.admin = User.objects.create_superuser(
            username="suggestion-admin",
            email="suggestion-admin@example.com",
            password="test-password",
        )
        self.client = APIClient()
        self.url = reverse("poll-list")

        self.public_poll = Poll.objects.create(
            created_by=self.owner,
            name="Natural Beauty",
            description="Hidden poll description",
            status=Poll.Status.IN_PROGRESS,
        )
        self.private_poll = Poll.objects.create(
            created_by=self.owner,
            name="Natural Private Draft",
            status=Poll.Status.DRAFT,
        )
        self.owner_poll = Poll.objects.create(
            created_by=self.viewer,
            name="Nature owned by viewer",
            status=Poll.Status.DRAFT,
        )

        self.public_question = self._create_question(
            poll=self.public_poll,
            name="Natural landmarks?",
            option_name="Northern Areas",
        )
        self.private_question = self._create_question(
            poll=self.private_poll,
            name="Natural private question",
            option_name="Private Northern Area",
        )
        self.owner_question = self._create_question(
            poll=self.owner_poll,
            name="Natural viewer question",
            option_name="Viewer Northern Area",
            owner=self.viewer,
        )

    def _create_question(self, *, poll, name, option_name, owner=None):
        question = Question.objects.create(name=name, created_by=owner or self.owner)
        PollQuestion.objects.create(poll=poll, question=question)
        AnswerOption.objects.create(question=question, name=option_name)
        return question

    def _get(self, *, user, search_type, query):
        self.client.force_authenticate(user=user)
        return self.client.get(
            self.url,
            {"mode": "suggestions", "type": search_type, "q": query},
        )

    def test_normal_poll_listing_remains_unaffected(self):
        self.client.force_authenticate(user=self.viewer)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["message"], "Polls retrieved successfully.")
        self.assertIn("pagination", response.data)
        poll_names = [item["name"] for item in response.data["data"]]
        self.assertIn(self.public_poll.name, poll_names)
        self.assertIn(self.owner_poll.name, poll_names)
        self.assertNotIn(self.private_poll.name, poll_names)

    def test_poll_search_is_case_insensitive_partial_and_prioritizes_prefixes(self):
        starts_with_upper = Poll.objects.create(
            created_by=self.owner,
            name="NATURAL RESOURCES",
            status=Poll.Status.IN_PROGRESS,
        )
        contains = Poll.objects.create(
            created_by=self.owner,
            name="Beauty of Natural Places",
            status=Poll.Status.IN_PROGRESS,
        )

        response = self._get(user=self.viewer, search_type="poll", query="nat")

        self.assertEqual(response.status_code, 200)
        names = [item["name"] for item in response.data["data"]]
        self.assertEqual(names[:2], ["Natural Beauty", starts_with_upper.name])
        self.assertIn(contains.name, names)

    def test_searches_only_relevant_name_fields_and_returns_option_context(self):
        Poll.objects.create(
            created_by=self.owner,
            name="Unrelated poll",
            description="Natural description only",
            status=Poll.Status.IN_PROGRESS,
        )
        Question.objects.create(name="Unrelated question", created_by=self.owner)
        unrelated_question = Question.objects.create(
            name="Question context natural only",
            created_by=self.owner,
        )
        AnswerOption.objects.create(question=unrelated_question, name="Unrelated option")

        poll_response = self._get(user=self.viewer, search_type="poll", query="natural")
        poll_question_only_response = self._get(
            user=self.viewer,
            search_type="poll",
            query="landmarks",
        )
        poll_option_only_response = self._get(
            user=self.viewer,
            search_type="poll",
            query="northern",
        )
        question_response = self._get(
            user=self.viewer,
            search_type="question",
            query="northern",
        )
        option_response = self._get(
            user=self.viewer,
            search_type="answer_option",
            query="natural",
        )
        northern_response = self._get(
            user=self.viewer,
            search_type="answer_option",
            query="northern",
        )

        self.assertNotIn("Unrelated poll", [item["name"] for item in poll_response.data["data"]])
        self.assertEqual(poll_question_only_response.data["data"], [])
        self.assertEqual(poll_option_only_response.data["data"], [])
        self.assertEqual(question_response.data["data"], [])
        self.assertEqual(option_response.data["data"], [])
        self.assertEqual(
            northern_response.data["data"],
            [
                {
                    "id": self.public_question.answer_options.get().id,
                    "name": "Northern Areas",
                    "question_name": "Natural landmarks?",
                },
                {
                    "id": self.owner_question.answer_options.get().id,
                    "name": "Viewer Northern Area",
                    "question_name": "Natural viewer question",
                },
            ],
        )

    def test_question_and_option_search_respect_poll_visibility(self):
        viewer_questions = self._get(
            user=self.viewer,
            search_type="question",
            query="natural",
        )
        viewer_options = self._get(
            user=self.viewer,
            search_type="answer_option",
            query="northern",
        )
        admin_questions = self._get(
            user=self.admin,
            search_type="question",
            query="natural",
        )

        self.assertEqual(
            {item["name"] for item in viewer_questions.data["data"]},
            {self.public_question.name, self.owner_question.name},
        )
        self.assertEqual(
            {item["name"] for item in viewer_options.data["data"]},
            {"Northern Areas", "Viewer Northern Area"},
        )
        self.assertIn(
            self.private_question.name,
            {item["name"] for item in admin_questions.data["data"]},
        )

    def test_poll_visibility_hides_other_users_drafts_and_admin_sees_them(self):
        viewer_response = self._get(user=self.viewer, search_type="poll", query="natural")
        admin_response = self._get(user=self.admin, search_type="poll", query="natural")

        viewer_names = {item["name"] for item in viewer_response.data["data"]}
        admin_names = {item["name"] for item in admin_response.data["data"]}
        self.assertNotIn(self.private_poll.name, viewer_names)
        self.assertIn(self.public_poll.name, viewer_names)
        self.assertIn(self.private_poll.name, admin_names)

    def test_returns_at_most_ten_results(self):
        Poll.objects.bulk_create([
            Poll(
                created_by=self.owner,
                name=f"Natural result {index}",
                status=Poll.Status.IN_PROGRESS,
            )
            for index in range(11)
        ])

        response = self._get(user=self.viewer, search_type="poll", query="natural")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]), 10)

    def test_short_query_returns_empty_without_database_search(self):
        self.client.force_authenticate(user=self.viewer)

        with self.assertNumQueries(0):
            response = self.client.get(
                self.url,
                {"mode": "suggestions", "type": "poll", "q": "N"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], [])

    def test_invalid_or_missing_query_parameters_return_validation_errors(self):
        self.client.force_authenticate(user=self.viewer)

        invalid_type = self.client.get(
            self.url,
            {"mode": "suggestions", "type": "invalid", "q": "natural"},
        )
        missing_type = self.client.get(
            self.url,
            {"mode": "suggestions", "q": "natural"},
        )
        missing_query = self.client.get(
            self.url,
            {"mode": "suggestions", "type": "poll"},
        )

        for response in (invalid_type, missing_type, missing_query):
            self.assertEqual(response.status_code, 400)
            self.assertFalse(response.data["success"])
            self.assertEqual(response.data["message"], "Validation failed.")

    def test_authentication_is_required(self):
        response = self.client.get(
            self.url,
            {"mode": "suggestions", "type": "poll", "q": "natural"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.data["success"])
