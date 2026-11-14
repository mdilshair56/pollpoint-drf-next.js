import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return <Suspense fallback={<div className="text-sm text-slate-500">Loading sign-in…</div>}><LoginForm /></Suspense>;
}
