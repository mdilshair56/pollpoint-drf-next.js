import { apiClient } from "@/lib/api/api-client";

export interface PasswordResetPayload {
  uid: string;
  token: string;
  new_password: string;
  confirm_password: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: unknown;
  status_code?: number;
}

export async function resetPassword(
  payload: PasswordResetPayload
): Promise<PasswordResetResponse> {
  return apiClient.post<PasswordResetResponse>(
    "/api/session/password-reset/",
    payload
  );
}
