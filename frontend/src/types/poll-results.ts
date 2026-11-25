export interface MiniUser {
  user_id: number;
  first_name: string;
  last_name: string;
}

export interface AnswerOptionResult {
  id: number;
  name: string;
  voters: MiniUser[];
}

export interface QuestionResult {
  poll_question_id: number;
  question_id: number;
  Question_name: string;
  answer_options: AnswerOptionResult[];
}

export interface PollResultDetail {
  poll_id: number;
  poll_name: string;
  description?: string;
  created_by: MiniUser;
  created_at: string;
  starts_at: string;
  ends_at: string;
  status: "draft" | "in_progress" | "completed";
  result_visibility: "live" | "after_submission" | "polls_end" | "restricted";
  questions: QuestionResult[];
}

export interface PollResultFilters {
  status?: string;
  result_visibility?: string;
  search?: string;
  user_id?: number | string;
  user_name?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}
