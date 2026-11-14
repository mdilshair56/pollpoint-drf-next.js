import { apiClient } from "@/lib/api/api-client";
import type { ApiEnvelope } from "@/types/api";
import type {
  LoginPayload,
  PasswordResetConfirm,
  PasswordResetRequest,
  SignupPayload,
  User,
  UserProfile,
} from "@/types/auth";

export class AuthService {
  login(payload: LoginPayload) {
    return apiClient.post<ApiEnvelope<{ user: User }>>("/api/session/login/", payload);
  }

  signup(payload: SignupPayload) {
    return apiClient.post<ApiEnvelope<User>>("/api/session/signup/", payload);
  }

  requestOtp(email: string) {
    return apiClient.post<{ detail: string }>("/api/session/request-otp/", { email });
  }

  verifyOtp(email: string, otp: string) {
    return apiClient.post<ApiEnvelope<{ user: User }>>(
      "/api/session/verify-otp/",
      { email, otp },
    );
  }

  getCurrentUser() {
    return apiClient.get<ApiEnvelope<User>>("/api/session/me/");
  }

  getMyProfile() {
    return apiClient.get<UserProfile>("/api/backend/auth/profiles/mine/");
  }

  logout() {
    return apiClient.post<ApiEnvelope<null>>("/api/session/logout/");
  }

  requestPasswordReset(payload: PasswordResetRequest) {
    return apiClient.post<ApiEnvelope<null>>("/api/session/password-reset/", payload);
  }

  confirmPasswordReset(payload: PasswordResetConfirm) {
    return apiClient.post<ApiEnvelope<null>>("/api/session/password-reset/", payload);
  }
}

export const authService = new AuthService();
