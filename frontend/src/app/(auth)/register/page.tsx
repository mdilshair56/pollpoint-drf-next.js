import { Suspense } from "react";
import { SignupForm } from "@/components/auth/signup-form";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading registration…</div>}>
      <SignupForm />
    </Suspense>
  );
}
