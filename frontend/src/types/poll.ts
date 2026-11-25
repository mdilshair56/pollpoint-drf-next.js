import type { PaginationMeta } from "@/types/api";

export type PollStatus = "draft" | "in_progress" | "completed";
export type ResultVisibility = "live" | "after_submission" | "polls_end" | "restricted";

export interface MiniUser {
  first_name: string;
  last_name: string;
}

export interface PollSummary {
  id: number;
  name: string;
  status: PollStatus;
  created_by: MiniUser;
  can_manage: boolean;
}

export interface AnswerOption {
  id: number;
  name: string;
  order: number;
}

export interface PollQuestion {
  id: number;
  question_name: string;
  question_description: string;
  order: number;
  options: AnswerOption[];
  my_vote: {
    answer_option_id: number;
    selected_option_name: string;
  } | null;
}

export interface PollDetail {
  id: number;
  name: string;
  description: string;
  status: PollStatus;
  result_visibility: ResultVisibility;
  email_report_on_completion: boolean;
  email_report_excel: boolean;
  email_report_pdf: boolean;
  created_by: MiniUser;
  can_manage: boolean;
  starts_at: string | null;
  ends_at: string | null;
  questions: PollQuestion[];
}

export interface PollFilters {
  search?: string;
  status?: PollStatus | "";
  result_visibility?: ResultVisibility | "";
  ordering?: "name" | "-name" | "created_at" | "-created_at" | "starts_at" | "-starts_at" | "ends_at" | "-ends_at";
  page?: number;
  page_size?: number;
  created_after?: string;
  created_before?: string;
  starts_after?: string;
  starts_before?: string;
  ends_after?: string;
  ends_before?: string;
}

export interface PollCreatePayload {
  name: string;
  description: string;
  result_visibility: ResultVisibility;
  email_report_on_completion: boolean;
  email_report_excel: boolean;
  email_report_pdf: boolean;
  starts_at?: string;
  ends_at?: string;
  questions?: {
    name: string;
    description: string;
    options: { name: string; order: number }[];
  }[];
}

export interface PollCreated {
  id: number;
  name: string;
  description: string;
  status: PollStatus;
  result_visibility: ResultVisibility;
  email_report_on_completion: boolean;
  email_report_excel: boolean;
  email_report_pdf: boolean;
  questions: unknown[];
}

export interface PollListResult {
  data: PollSummary[];
  pagination: PaginationMeta;
}
