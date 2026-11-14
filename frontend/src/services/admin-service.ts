import { apiClient } from "@/lib/api/api-client";
import type { ApiEnvelope } from "@/types/api";
import type { User } from "@/types/auth";

export interface AdminInvitation {
  id: string;
  email: string;
  status: "pending" | "accepted" | "declined" | "expired";
  invited_by_email: string;
  accepted_by_email: string | null;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
}

export type UserListResponse =
  | User[]
  | { results?: User[]; data?: User[]; pagination?: unknown }
  | ApiEnvelope<User[]>
  | { success: boolean; message: string; data: User[]; pagination?: unknown };

export class AdminService {
  currentUser() {
    return apiClient
      .get<ApiEnvelope<User>>("/api/session/me/")
      .then((response) => response.data);
  }

  users() {
    return apiClient.get<UserListResponse>("/api/backend/auth/users/");
  }

  invitations() {
    return apiClient.get<ApiEnvelope<AdminInvitation[]>>("/api/backend/auth/invitations/");
  }

  invite(email: string) {
    return apiClient.post<ApiEnvelope<AdminInvitation>>("/api/backend/auth/invitations/", { email });
  }

  promote(user_id: number, role: "client" | "admin" | "superadmin") {
    return apiClient.post<ApiEnvelope<User>>("/api/backend/auth/users/promote/", { user_id, role });
  }

  previewInvitation(token: string) {
    return apiClient.get<ApiEnvelope<{ email: string; invited_by: string; expires_at: string }>>(
      "/api/backend/auth/invitations/preview/?token=" + encodeURIComponent(token),
    );
  }

  respondInvitation(token: string, decision: "accept" | "decline") {
    return apiClient.post<ApiEnvelope<AdminInvitation>>(
      "/api/backend/auth/invitations/respond/",
      { token, decision },
    );
  }
}

export const adminService = new AdminService();
