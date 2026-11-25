from common.exceptions import ConflictError, ResourceNotFoundError
from polls.models import Poll, PollQuestion, Vote
from polls.permissions import is_admin


class PollResultsService:

    ALLOWED_REGULAR_VISIBILITIES = [
        Poll.ResultVisibility.LIVE,
        Poll.ResultVisibility.AFTER_SUBMISSION,
        Poll.ResultVisibility.POLLS_END,
    ]

    @classmethod
    def get_eligible_polls_queryset(cls, *, user):
        """
        Return the base queryset of polls the user is authorized to access.
        - Excludes DRAFT polls (results are allowed for all non-draft statuses: IN_PROGRESS, COMPLETED).
        - Regular users can only access polls with result_visibility in
          (LIVE, AFTER_SUBMISSION, POLLS_END) - excluding RESTRICTED.
        - Admin and SuperAdmin users can view all non-draft polls (including RESTRICTED).
        Filtering by status, visibility, search, user, etc. is handled cleanly
        by DRF filter_backends (DjangoFilterBackend, SearchFilter) in the ViewSet.
        """
        queryset = Poll.objects.exclude(status=Poll.Status.DRAFT).select_related("created_by")

        if not is_admin(user):
            queryset = queryset.filter(result_visibility__in=cls.ALLOWED_REGULAR_VISIBILITIES)

        return queryset.order_by("-created_at")

    @classmethod
    def get_poll_for_results(cls, *, poll_id, user):
        """
        Validate and retrieve a single poll for result computation.
        - If poll does not exist or user is unauthorized: raises ResourceNotFoundError (404).
        - If poll exists and is authorized but in DRAFT status: raises ConflictError (409).
        - Results are allowed for IN_PROGRESS and COMPLETED polls.
        """
        try:
            poll = Poll.objects.select_related("created_by").get(pk=poll_id)
        except Poll.DoesNotExist:
            raise ResourceNotFoundError("The requested poll was not found.")

        # Check authorization based on result_visibility:
        # Regular users can only view live, after_submission, and polls_end.
        # RESTRICTED is exclusively accessible to Admin and SuperAdmin.
        if not is_admin(user):
            if poll.result_visibility not in cls.ALLOWED_REGULAR_VISIBILITIES:
                raise ResourceNotFoundError("You're not allowed to see the results for Restricted Polls.")

        # Disallow results only for DRAFT polls
        if poll.status == Poll.Status.DRAFT:
            raise ConflictError("Poll is in draft status. Results are not available yet.")

        return poll

    @staticmethod
    def compute_results_for_polls(polls):
        """
        Optimized batch calculation for a collection/page of polls.
        Avoids N+1 queries by fetching votes with voter profiles in a single query.
        Returns a list of structured poll result dictionaries matching the requested schema.
        """
        if not polls:
            return []

        poll_ids = [p.pk for p in polls]

        # 1. Fetch all PollQuestions and AnswerOptions ordered by poll and question order
        poll_questions = list(
            PollQuestion.objects.filter(poll_id__in=poll_ids)
            .select_related("question")
            .prefetch_related("question__answer_options")
            .order_by("poll_id", "order", "pk")
        )

        if not poll_questions:
            return [
                {
                    "poll_id": poll.pk,
                    "poll_name": poll.name,
                    "description": poll.description,
                    "created_by": poll.created_by,
                    "created_at": poll.created_at,
                    "starts_at": poll.starts_at,
                    "ends_at": poll.ends_at,
                    "status": poll.status,
                    "result_visibility": poll.result_visibility,
                    "questions": [],
                }
                for poll in polls
            ]

        poll_question_ids = [pq.pk for pq in poll_questions]

        # 2. Fetch all votes for these poll questions with user details in a single query
        votes_qs = (
            Vote.objects.filter(poll_question_id__in=poll_question_ids)
            .select_related("user")
            .only("id", "poll_question_id", "answer_id", "user__id", "user__first_name", "user__last_name")
            .order_by("created_at")
        )

        # Map: (poll_question_id, answer_id) -> list of User objects
        voters_map = {}
        for vote in votes_qs:
            key = (vote.poll_question_id, vote.answer_id)
            voters_map.setdefault(key, []).append(vote.user)

        # 3. Group PollQuestions by poll_id
        poll_questions_by_poll = {}
        for pq in poll_questions:
            poll_questions_by_poll.setdefault(pq.poll_id, []).append(pq)

        results = []
        for poll in polls:
            p_questions = poll_questions_by_poll.get(poll.pk, [])
            questions_data = []

            for pq in p_questions:
                answer_options = list(pq.question.answer_options.all())
                answers_data = []

                for option in answer_options:
                    voters_for_option = voters_map.get((pq.pk, option.pk), [])
                    answers_data.append({
                        "id": option.pk,
                        "name": option.name,
                        "voters": voters_for_option,
                    })

                questions_data.append({
                    "poll_question_id": pq.pk,
                    "question_id": pq.question_id,
                    "Question_name": pq.question.name,
                    "answer_options": answers_data,
                })

            results.append({
                "poll_id": poll.pk,
                "poll_name": poll.name,
                "description": poll.description,
                "created_by": poll.created_by,
                "created_at": poll.created_at,
                "starts_at": poll.starts_at,
                "ends_at": poll.ends_at,
                "status": poll.status,
                "result_visibility": poll.result_visibility,
                "questions": questions_data,
            })

        return results

    @classmethod
    def get_single_poll_result(cls, *, poll_id, user):
        """
        Validate and calculate complete results for a single poll.
        """
        poll = cls.get_poll_for_results(poll_id=poll_id, user=user)
        results = cls.compute_results_for_polls([poll])
        return results[0]
