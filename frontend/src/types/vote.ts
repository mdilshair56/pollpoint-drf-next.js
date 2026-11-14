import type { MiniUser, PollStatus, ResultVisibility } from "@/types/poll";

export interface VoteSelection {
  poll_question_id: number;
  answer_option_id: number;
}

export interface PollVoteSubmission {
  poll_id: number;
  votes: VoteSelection[];
}

export interface VoteSubmissionPayload {
  polls: PollVoteSubmission[];
}

export interface VoteCastResponse {
  polls: {
    poll: {
      id: number;
      name: string;
      created_by: MiniUser;
    };
    votes: {
      poll_question_id: number;
      question_name: string;
      answer_option_id: number;
      selected_option_name: string;
    }[];
  }[];
}

export interface AnswerResult {
  answer_id: number;
  answer: string;
  votes: number;
  percentage: number;
}

export interface PollQuestionResult {
  poll_question_id: number;
  question_id: number;
  question: string;
  total_votes: number;
  answers: AnswerResult[];
}

export interface PollResult {
  poll_id: number;
  poll_name: string;
  status: PollStatus;
  result_visibility: ResultVisibility;
  unique_voters: number;
  questions: PollQuestionResult[];
}
