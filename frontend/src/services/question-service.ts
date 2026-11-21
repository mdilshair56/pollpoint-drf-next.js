import { apiClient } from "@/lib/api/api-client";
import type { PaginatedApiResponse } from "@/types/api";

export interface QuestionSummary {
  id: number;
  name: string;
}

export class QuestionService {
  async searchQuestions(query: string, signal?: AbortSignal): Promise<QuestionSummary[]> {
    const params = new URLSearchParams({ search: query });
    const response = await apiClient.request<PaginatedApiResponse<QuestionSummary>>(
      "/api/backend/questions/?" + params.toString(),
      { method: "GET", signal },
    );
    return response.data ?? [];
  }
}

export const questionService = new QuestionService();
export const searchQuestions = (query: string, signal?: AbortSignal) =>
  questionService.searchQuestions(query, signal);
