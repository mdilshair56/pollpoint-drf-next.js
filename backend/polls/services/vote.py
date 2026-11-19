from django.db import IntegrityError, transaction
from django.utils import timezone
from django.db.models import Count

from common.exceptions import (
    APIValidationError,
    ConflictError,
    ResourceNotFoundError,
)
from common.utils.constraints import get_unique_constraint_fields
from polls.models import AnswerOption, Poll, PollQuestion, Vote


class VoteServices:

    @staticmethod
    def _validate_positive_id(value, field_name):
        if (
            not isinstance(value, int)
            or isinstance(value, bool)
            or value < 1
        ):
            raise APIValidationError({
                field_name: "A valid positive integer ID is required."
            })

    @staticmethod
    def _validate_payload(polls_data):

        """
        Validate the structure and IDs of the voting submission.
        """

        if not isinstance(polls_data, list) or not polls_data:
            raise APIValidationError({
                "polls": "At least one poll is required."
            })

        for poll_index, group in enumerate(polls_data):

            if not isinstance(group, dict):
                raise APIValidationError({
                    "polls": {
                        poll_index: "Each poll must be an object."
                    }
                })

            if "poll_id" not in group:
                raise APIValidationError({
                    "polls": {
                        poll_index: {
                            "poll_id": "This field is required."
                        }
                    }
                })

            VoteServices._validate_positive_id(
                group["poll_id"],
                f"polls[{poll_index}].poll_id",
            )

            votes = group.get("votes")

            if not isinstance(votes, list) or not votes:
                raise APIValidationError({
                    "polls": {
                        poll_index: {
                            "votes": "At least one vote is required."
                        }
                    }
                })

            for vote_index, item in enumerate(votes):

                if not isinstance(item, dict):
                    raise APIValidationError({
                        "polls": {
                            poll_index: {
                                "votes": {
                                    vote_index: "Each vote must be an object."
                                }
                            }
                        }
                    })

                for field in ("poll_question_id", "answer_option_id"):
                    if field not in item:
                        raise APIValidationError({
                            "polls": {
                                poll_index: {
                                    "votes": {
                                        vote_index: {
                                            field: "This field is required."
                                        }
                                    }
                                }
                            }
                        })

                    VoteServices._validate_positive_id(
                        item[field],
                        f"polls[{poll_index}].votes[{vote_index}].{field}",
                    )

    @staticmethod
    @transaction.atomic
    def cast_votes(*, user, polls_data):

        # 1. Validate the request structure and IDs.
        VoteServices._validate_payload(polls_data)

        # 2. Collect poll IDs and reject duplicate poll submissions.
        poll_ids = [
            group["poll_id"]
            for group in polls_data
        ]

        unique_poll_ids = set(poll_ids)

        if len(poll_ids) != len(unique_poll_ids):
            raise APIValidationError({
                "polls": "Each poll can appear only once in a submission."
            })

        # 3. Fetch polls and lock them during the transaction.
        polls_by_id = (
            Poll.objects
            .select_for_update()
            .select_related("created_by")
            .filter(pk__in=unique_poll_ids)
            .in_bulk()
        )

        missing_poll_ids = unique_poll_ids - set(polls_by_id)

        if missing_poll_ids:
            raise ResourceNotFoundError(
                f"Poll(s) not found: {sorted(missing_poll_ids)}"
            )

        # 4. Enforce lifecycle status and the actual scheduled voting window.
        now = timezone.now()
        unavailable_poll_ids = [
            poll_id
            for poll_id, poll in polls_by_id.items()
            if (
                poll.status != Poll.Status.IN_PROGRESS
                or now < poll.starts_at
                or now >= poll.ends_at
            )
        ]

        if unavailable_poll_ids:
            raise ConflictError(
                "Voting is allowed only for published polls within their "
                "configured start and end times. "
                f"Poll ID(s): {sorted(unavailable_poll_ids)}"
            )

        # 5. Collect question and answer IDs.
        all_poll_question_ids = []
        all_answer_option_ids = []
        seen_question_ids = set()
        duplicate_errors = {}

        for poll_index, group in enumerate(polls_data):
            for vote_index, item in enumerate(group["votes"]):

                poll_question_id = item["poll_question_id"]

                # A PollQuestion can appear only once in the entire request.
                if poll_question_id in seen_question_ids:
                    duplicate_errors.setdefault(
                        poll_index, {}
                    ).setdefault("votes", {})[vote_index] = {
                        "poll_question_id": (
                            "A poll question can appear only once "
                            "in a submission."
                        )
                    }
                else:
                    seen_question_ids.add(poll_question_id)

                all_poll_question_ids.append(poll_question_id)
                all_answer_option_ids.append(item["answer_option_id"])

        if duplicate_errors:
            raise APIValidationError({
                "polls": duplicate_errors
            })

        unique_question_ids = set(all_poll_question_ids)
        unique_answer_ids = set(all_answer_option_ids)

        # 6. Fetch PollQuestion records.
        poll_questions = (
            PollQuestion.objects
            .select_related("question")
            .filter(pk__in=unique_question_ids)
            .in_bulk()
        )

        missing_question_ids = (
            unique_question_ids - set(poll_questions)
        )

        if missing_question_ids:
            raise ResourceNotFoundError(
                f"Poll question(s) not found: "
                f"{sorted(missing_question_ids)}"
            )

        # 7. Fetch AnswerOption records.
        answer_options = (
            AnswerOption.objects
            .select_related("question")
            .filter(pk__in=unique_answer_ids)
            .in_bulk()
        )

        missing_answer_ids = (
            unique_answer_ids - set(answer_options)
        )

        if missing_answer_ids:
            raise ResourceNotFoundError(
                f"Answer option(s) not found: "
                f"{sorted(missing_answer_ids)}"
            )

        # 8. Validate relationships.
        relationship_errors = {}

        for poll_index, group in enumerate(polls_data):
            for vote_index, item in enumerate(group["votes"]):

                poll_question = poll_questions[
                    item["poll_question_id"]
                ]

                answer_option = answer_options[
                    item["answer_option_id"]
                ]

                item_errors = {}

                # Ensure the question belongs to the submitted poll.
                if poll_question.poll_id != group["poll_id"]:
                    item_errors["poll_question_id"] = (
                        "This question does not belong "
                        "to the selected poll."
                    )

                # Ensure the answer option belongs to that question.
                if (
                    answer_option.question_id
                    != poll_question.question_id
                ):
                    item_errors["answer_option_id"] = (
                        "This answer option does not belong "
                        "to this question."
                    )

                if item_errors:
                    relationship_errors.setdefault(
                        poll_index, {}
                    ).setdefault("votes", {})[vote_index] = item_errors

        if relationship_errors:
            raise APIValidationError({
                "polls": relationship_errors
            })

        # 9. Prepare Vote objects.
        vote_objects = [
            Vote(
                user=user,
                poll_question=poll_questions[
                    item["poll_question_id"]
                ],
                answer=answer_options[
                    item["answer_option_id"]
                ],
            )
            for group in polls_data
            for item in group["votes"]
        ]

        # 10. Get the unique constraint fields.
        unique_fields = get_unique_constraint_fields(
            Vote,
            "unique_user_vote_per_question",
        )

        # 11. Bulk insert or update existing votes.
        try:
            Vote.objects.bulk_create(
                vote_objects,
                update_conflicts=True,
                unique_fields=unique_fields,
                update_fields=["answer", "updated_at"],
            )

        except IntegrityError as exc:
            raise ConflictError(
                "The votes could not be saved because of a "
                "database conflict. Please refresh and try again."
            ) from exc

        # 12. Fetch saved votes for the response.
        saved_votes = (
            Vote.objects
            .filter(
                user=user,
                poll_question_id__in=unique_question_ids,
            )
            .select_related(
                "poll_question__question",
                "answer",
            )
        )

        saved_votes_by_question = {
            vote.poll_question_id: vote
            for vote in saved_votes
        }

        # 13. Rebuild results in the original request order.
        poll_results = []

        for group in polls_data:

            ordered_votes = [
                saved_votes_by_question[item["poll_question_id"]]
                for item in group["votes"]
            ]

            poll_results.append({
                "poll": polls_by_id[group["poll_id"]],
                "votes": ordered_votes,
            })

        return {
            "polls": poll_results,
        }

    @staticmethod
    def can_view_results(*, poll, user):
        visibility = poll.result_visibility

        # Option 1: Results are always visible.
        if visibility == Poll.ResultVisibility.LIVE:
            return True

        # Option 2: The current user must answer every poll question.
        if visibility == Poll.ResultVisibility.AFTER_SUBMISSION:
            total_questions = PollQuestion.objects.filter(
                poll_id=poll.pk
            ).count()

            if total_questions == 0:
                return False

            answered_questions = (
                Vote.objects.filter(
                    user_id=user.pk,
                    poll_question__poll_id=poll.pk,
                )
                .values("poll_question_id")
                .distinct()
                .count()
            )

            return answered_questions == total_questions

        # Option 3: Results are available once the poll has ended.
        if visibility == Poll.ResultVisibility.POLLS_END:
            return bool(
                poll.status == Poll.Status.COMPLETED
                or (
                    poll.ends_at is not None
                    and timezone.now() >= poll.ends_at
                )
            )

        # Restricted or any unsupported visibility keeps results hidden.
        return False

    @staticmethod
    def get_poll_results(*, poll):

        poll_questions = (
            PollQuestion.objects
            .filter(poll_id=poll.pk)
            .select_related("question")
            .prefetch_related("question__answer_options")
            .order_by("order", "pk")
        )

        # Aggregate votes for each poll question and answer.
        vote_counts = (
            Vote.objects
            .filter(poll_question__poll_id=poll.pk)
            .values("poll_question_id", "answer_id")
            .annotate(total=Count("pk"))
            .order_by()
        )

        counts = {
            (row["poll_question_id"], row["answer_id"]): row["total"]
            for row in vote_counts
        }

        questions_data = []

        for poll_question in poll_questions:

            answer_options = (
                poll_question.question.answer_options.all()
            )

            total_votes = sum(
                counts.get(
                    (poll_question.pk, answer.pk), 0
                )
                for answer in answer_options
            )

            answers_data = []

            for answer in answer_options:
                answer_votes = counts.get(
                    (poll_question.pk, answer.pk), 0
                )

                percentage = (
                    (answer_votes / total_votes) * 100
                    if total_votes
                    else 0
                )

                answers_data.append({
                    "answer_id": answer.pk,
                    "answer": answer.name,
                    "votes": answer_votes,
                    "percentage": round(percentage, 2),
                })

            questions_data.append({
                "poll_question_id": poll_question.pk,
                "question_id": poll_question.question_id,
                "question": poll_question.question.name,
                "total_votes": total_votes,
                "answers": answers_data,
            })

        unique_voters = (
            Vote.objects
            .filter(poll_question__poll_id=poll.pk)
            .values("user_id")
            .distinct()
            .count()
        )

        return {
            "poll_id": poll.pk,
            "poll_name": poll.name,
            "status": poll.status,
            "result_visibility": poll.result_visibility,
            "unique_voters": unique_voters,
            "questions": questions_data,
        }
