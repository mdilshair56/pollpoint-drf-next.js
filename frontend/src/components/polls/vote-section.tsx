"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/api/api-client";
import { notify } from "@/lib/notifications";
import { voteService } from "@/services/vote-service";
import type { PollDetail } from "@/types/poll";
import type {
  AnswerResult,
  PollResult,
  VoteSubmissionPayload,
} from "@/types/vote";

type SavedVote = NonNullable<PollDetail["questions"][number]["my_vote"]>;

function getAnswerResult(
  answers: AnswerResult[] | undefined,
  answerId: number,
) {
  return answers?.find((answer) => answer.answer_id === answerId);
}

interface VoteSectionProps {
  poll: PollDetail;
  canVote: boolean;
}

function getInitialSavedVotes(poll: PollDetail): Record<number, SavedVote> {
  return Object.fromEntries(
    poll.questions.flatMap((question) =>
      question.my_vote ? [[question.id, question.my_vote]] : [],
    ),
  ) as Record<number, SavedVote>;
}

function getInitialSelections(poll: PollDetail): Record<number, number> {
  return Object.fromEntries(
    poll.questions.flatMap((question) =>
      question.my_vote
        ? [[question.id, question.my_vote.answer_option_id]]
        : [],
    ),
  ) as Record<number, number>;
}

export default function VoteSection({
  poll,
  canVote,
}: VoteSectionProps) {
  // Poll detail already includes the authenticated user's my_vote per question.
  const [savedVotes, setSavedVotes] = useState(() => getInitialSavedVotes(poll));
  const [selectedAnswers, setSelectedAnswers] = useState(() => getInitialSelections(poll));
  const [submitting, setSubmitting] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [results, setResults] = useState<PollResult | null>(null);
  const [voteMessage, setVoteMessage] = useState("");
  const [voteError, setVoteError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const [resultError, setResultError] = useState("");

  const loadResults = useCallback(async () => {
    if (poll.status === "draft") {
      setResults(null);
      setResultMessage("Results are not available for draft polls.");
      return;
    }

    setLoadingResults(true);
    setResultError("");
    setResultMessage("");

    try {
      const response = await voteService.getPollResults(poll.id);
      setResults(response.data);
    } catch (error: unknown) {
      setResults(null);

      if (error instanceof ApiError && error.status === 403) {
        switch (poll.result_visibility) {
          case "after_submission":
            setResultMessage(
              "Answer every question in this poll to view its results.",
            );
            break;
          case "polls_end":
            setResultMessage(
              "Results will become available after this poll ends.",
            );
            break;
          case "restricted":
            setResultMessage("The results for this poll are restricted.");
            break;
          default:
            setResultMessage("Results are not currently available.");
        }
      } else {
        setResultError(
          error instanceof ApiError
            ? error.message
            : "Unable to retrieve poll results.",
        );
      }
    } finally {
      setLoadingResults(false);
    }
  }, [poll.id, poll.status, poll.result_visibility]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadResults();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadResults]);

  // Keep live results fresh while the poll detail page is open.
  useEffect(() => {
    if (poll.result_visibility !== "live" || poll.status === "draft") {
      return;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadResults();
      }
    }, 10_000);

    return () => window.clearInterval(interval);
  }, [loadResults, poll.result_visibility, poll.status]);

  // Automatically request final results when the scheduled poll end time arrives.
  useEffect(() => {
    if (
      poll.result_visibility !== "polls_end" ||
      poll.status !== "in_progress" ||
      !poll.ends_at ||
      results?.poll_id === poll.id
    ) {
      return;
    }

    const endTime = new Date(poll.ends_at).getTime();
    if (!Number.isFinite(endTime)) return;

    let timer: number;
    const checkEndTime = () => {
      const remaining = endTime - Date.now();

      if (remaining <= 0) {
        void loadResults();
        // Retry periodically if the server clock has not yet unlocked results.
        timer = window.setTimeout(checkEndTime, 15_000);
        return;
      }

      timer = window.setTimeout(
        checkEndTime,
        Math.min(remaining + 1000, 2_147_000_000),
      );
    };

    checkEndTime();
    return () => window.clearTimeout(timer);
  }, [
    loadResults,
    poll.ends_at,
    poll.id,
    poll.result_visibility,
    poll.status,
    results?.poll_id,
  ]);

  const handleAnswerSelect = (
    pollQuestionId: number,
    answerOptionId: number,
  ) => {
    if (savedVotes[pollQuestionId]) return;

    setSelectedAnswers((current) => ({
      ...current,
      [pollQuestionId]: answerOptionId,
    }));
    setVoteError("");
  };

  const handleSubmitVotes = async () => {
    const votes = poll.questions
      .filter(
        (question) =>
          !savedVotes[question.id] &&
          selectedAnswers[question.id] !== undefined,
      )
      .map((question) => ({
        poll_question_id: question.id,
        answer_option_id: selectedAnswers[question.id],
      }));

    if (votes.length === 0) {
      setVoteError("Choose at least one unanswered question before submitting.");
      return;
    }

    if (!canVote) {
      setVoteError("Voting is not currently available.");
      return;
    }

    const payload: VoteSubmissionPayload = {
      polls: [{ poll_id: poll.id, votes }],
    };

    setSubmitting(true);
    setVoteError("");
    setVoteMessage("");

    try {
      const response = await notify.promise(
        voteService.castVotes(payload),
        {
          loading: "Submitting votes...",
          success: "Votes submitted successfully!",
          error: "Unable to submit your votes.",
        }
      );
      const submittedVotes = response.data.polls.flatMap(
        (group) => group.votes,
      );

      setSavedVotes((current) => ({
        ...current,
        ...Object.fromEntries(
          submittedVotes.map((vote) => [
            vote.poll_question_id,
            {
              answer_option_id: vote.answer_option_id,
              selected_option_name: vote.selected_option_name,
            },
          ]),
        ),
      }));

      setVoteMessage(response.message || "Your votes were submitted successfully.");
      await loadResults();
    } catch (error: unknown) {
      setVoteError(
        error instanceof ApiError
          ? error.message
          : "Unable to submit your votes.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const hasNewSelections = poll.questions.some(
    (question) =>
      !savedVotes[question.id] &&
      selectedAnswers[question.id] !== undefined,
  );

  return (
    <section className="mt-6 space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-brand">
              {results ? "Poll answers & results" : "Cast Your Vote"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {results && poll.result_visibility === "live"
                ? "Live vote counts and percentages are shown beside each option."
                : "Select one answer for each question you want to answer."}
            </p>
            {results && (
              <p className="mt-1 text-xs text-muted">
                {results.unique_voters} unique voters
              </p>
            )}
          </div>
          {results && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
              {poll.result_visibility === "live"
                ? "Live results"
                : poll.result_visibility === "after_submission"
                  ? "Results unlocked"
                  : "Final results"}
            </span>
          )}
        </div>

        {loadingResults && !results && (
          <p className="text-sm text-muted">Loading poll results…</p>
        )}
        {resultMessage && (
          <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
            {resultMessage}
          </p>
        )}
        {resultError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {resultError}
          </p>
        )}
        {poll.result_visibility === "live" && poll.status !== "draft" && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void loadResults()}
              disabled={loadingResults}
              className="text-xs font-semibold text-interactive hover:underline disabled:opacity-50"
            >
              {loadingResults ? "Refreshing…" : "Refresh live results"}
            </button>
          </div>
        )}

        {poll.questions.slice().sort((a, b) => a.order - b.order).map((question, index) => {
          const savedVote = savedVotes[question.id];
          const questionResult = results?.questions.find(
            (item) => item.poll_question_id === question.id,
          );

          return (
            <section key={question.id} className="panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-interactive">
                Question {index + 1}
              </p>
              <h3 className="mt-2 text-lg font-bold text-ink">
                {question.question_name}
              </h3>

              {question.question_description && (
                <p className="mt-1 text-sm text-muted">
                  {question.question_description}
                </p>
              )}

              <div className="mt-4 space-y-3">
                {question.options.slice().sort((a, b) => a.order - b.order).map((option) => {
                  const answerResult = getAnswerResult(
                    questionResult?.answers,
                    option.id,
                  );
                  const percentage = answerResult?.percentage ?? 0;
                  const isMyAnswer = savedVote?.answer_option_id === option.id;

                  return (
                    <label
                      key={option.id}
                      className={
                        "block rounded-xl border p-4 transition-colors " +
                        (canVote && !savedVote
                          ? "cursor-pointer "
                          : "cursor-not-allowed ") +
                        (selectedAnswers[question.id] === option.id
                          ? "border-interactive bg-blue-50"
                          : "border-border")
                      }
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name={"question-" + question.id}
                          value={option.id}
                          checked={selectedAnswers[question.id] === option.id}
                          onChange={() => handleAnswerSelect(question.id, option.id)}
                          disabled={!canVote || submitting || Boolean(savedVote)}
                          className="mt-0.5 size-4 shrink-0 accent-blue-600"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-700">
                              {option.name}
                            </span>
                            {isMyAnswer && (
                              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">
                                Your answer
                              </span>
                            )}
                            {results && answerResult && (
                              <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600">
                                {answerResult.votes} votes · {percentage}%
                              </span>
                            )}
                          </div>

                          {results && answerResult && (
                            <div
                              className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100"
                              role="progressbar"
                              aria-label={option.name + ": " + percentage + "%"}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={percentage}
                            >
                              <div
                                className={
                                  "h-full rounded-full transition-[width] duration-700 ease-out " +
                                  (isMyAnswer ? "bg-orange-500" : "bg-blue-600")
                                }
                                style={{
                                  width: Math.max(0, Math.min(100, percentage)) + "%",
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}

                {savedVote && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    Your saved answer: {savedVote.selected_option_name}
                  </p>
                )}

                {question.options.length === 0 && (
                  <p className="text-sm text-muted">
                    No answer options were configured for this question.
                  </p>
                )}
              </div>
            </section>
          );
        })}

        {canVote && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {Object.keys(savedVotes).length} of {poll.questions.length} questions answered.
            </p>
            <button
              type="button"
              className="btn-accent"
              disabled={submitting || !hasNewSelections}
              onClick={() => void handleSubmitVotes()}
            >
              {submitting ? "Submitting…" : "Submit selected answers"}
            </button>
          </div>
        )}

        {voteMessage && (
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            {voteMessage}
          </p>
        )}
        {voteError && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {voteError}
          </p>
        )}
      </div>
    </section>
  );
}
