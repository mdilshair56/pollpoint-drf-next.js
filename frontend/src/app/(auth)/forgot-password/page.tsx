import { Suspense } from "react";
import { PasswordResetForm } from "@/components/auth/password-reset-form";

export default function ForgotPasswordPage() {
  return <Suspense fallback={<div className="text-sm text-slate-500">Loading password reset…</div>}><PasswordResetForm /></Suspense>;
}
