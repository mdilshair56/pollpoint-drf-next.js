export type UserRole = "superadmin" | "admin" | "client";

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  role: UserRole;
  is_superuser: boolean;
}

export interface UserProfile {
  user: User;
  father_name: string;
  date_of_birth: string | null;
  address: string;
  city: string;
  state: string;
  country: string;
}

export interface UpdateProfilePayload {
  father_name?: string;
  date_of_birth?: string | null;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface EmailChangeRequestPayload {
  email: string;
}

export interface EmailChangeVerifyPayload {
  otp: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface SignupPayload {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  password: string;
  profile?: {
    father_name?: string;
    date_of_birth?: string | null;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  uid: string;
  token: string;
  new_password: string;
  confirm_password: string;
}
