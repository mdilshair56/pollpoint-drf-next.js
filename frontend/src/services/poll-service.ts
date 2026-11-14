import { apiClient } from "@/lib/api/api-client";
import type { ApiEnvelope, PaginatedApiResponse } from "@/types/api";
import type {
  PollCreatePayload,
  PollCreated,
  PollDetail,
  PollFilters,
  PollSummary,
} from "@/types/poll";

export class PollService {
  async list(filters: PollFilters = {}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }

    const query = params.toString();
    const url = "/api/backend/polls/" + (query ? "?" + query : "");
    const response = await apiClient.get<PaginatedApiResponse<PollSummary>>(url);

    return {
      polls: response.data,
      pagination: response.pagination,
      message: response.message,
    };
  }

  getById(id: number) {
    return apiClient.get<ApiEnvelope<PollDetail>>("/api/backend/polls/" + id + "/");
  }

  create(payload: PollCreatePayload) {
    return apiClient.post<ApiEnvelope<PollCreated>>("/api/backend/polls/", payload);
  }

  update(id: number, payload: PollCreatePayload) {
    return apiClient.patch<ApiEnvelope<PollDetail>>(
      "/api/backend/polls/" + id + "/",
      payload,
    );
  }

  publish(id: number) {
    return apiClient.post<ApiEnvelope<PollDetail>>(
      "/api/backend/polls/" + id + "/publish/",
    );
  }

  close(id: number) {
    return apiClient.post<ApiEnvelope<PollDetail>>(
      "/api/backend/polls/" + id + "/close/",
    );
  }

  extend(id: number, endsAt: string) {
    return apiClient.post<ApiEnvelope<PollDetail>>(
      "/api/backend/polls/" + id + "/extend/",
      { ends_at: endsAt },
    );
  }

  delete(id: number) {
    return apiClient.delete<ApiEnvelope<{ id: number; name: string }>>(
      "/api/backend/polls/" + id + "/",
    );
  }
}

export const pollService = new PollService();
