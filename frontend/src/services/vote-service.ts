import { apiClient } from "@/lib/api/api-client";
import type { ApiEnvelope } from "@/types/api";
import type {
  PollResult,
  VoteCastResponse,
  VoteSubmissionPayload,
} from "@/types/vote";

const VOTE_API = "/api/backend/polls/vote/";

export const voteService = {
  async castVotes(payload: VoteSubmissionPayload) {
    return apiClient.post<ApiEnvelope<VoteCastResponse>>(
      VOTE_API,
      payload,
    );
  },

  async getPollResults(pollId: number) {
    return apiClient.get<ApiEnvelope<PollResult>>(
      VOTE_API + "results/?poll=" + pollId,
    );
  },
};
