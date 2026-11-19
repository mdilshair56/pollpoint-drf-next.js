import { apiClient } from "@/lib/api/api-client";
import type { ApiEnvelope } from "@/types/api";
import type { Suggestion, SuggestionSearchType } from "@/types/suggestion";

class SuggestionService {
  async search(
    searchType: SuggestionSearchType,
    query: string,
    signal?: AbortSignal,
  ): Promise<Suggestion[]> {
    const params = new URLSearchParams({
      mode: "suggestions",
      type: searchType,
      q: query,
    });
    const response = await apiClient.request<ApiEnvelope<Suggestion[]>>(
      "/api/backend/polls/?" + params.toString(),
      { method: "GET", signal },
    );
    return response.data;
  }
}

export const suggestionService = new SuggestionService();
