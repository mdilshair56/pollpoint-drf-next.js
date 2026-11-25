import { apiClient } from "@/lib/api/api-client";
import type { ApiEnvelope, PaginatedApiResponse } from "@/types/api";
import type { PollResultDetail, PollResultFilters } from "@/types/poll-results";

export class PollResultsService {
  async list(filters: PollResultFilters = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    }

    const query = params.toString();
    const url = "/api/backend/poll-results/" + (query ? "?" + query : "");
    const response = await apiClient.get<PaginatedApiResponse<PollResultDetail>>(url);

    return {
      results: response.data ?? [],
      pagination: response.pagination,
      message: response.message,
    };
  }

  async getById(pollId: number | string) {
    const response = await apiClient.get<ApiEnvelope<PollResultDetail>>(
      `/api/backend/poll-results/${pollId}/`
    );
    return response.data;
  }
}

export const pollResultsService = new PollResultsService();
