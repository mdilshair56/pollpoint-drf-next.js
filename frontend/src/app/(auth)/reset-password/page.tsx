
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import ResetPasswordForm from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Reset your account password.",
  robots: {
    index: false,
    follow: false,
  },
  referrer: "no-referrer",
};

interface ResetPasswordPageProps {
  searchParams: Promise<{
    uid?: string | string[];
    token?: string | string[];
  }>;
}

/**
 * Loading UI displayed while Next.js resolves search parameters.
 */
function ResetPasswordLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
        aria-live="polite"
      >
        <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-900" />

        <h1 className="text-xl font-semibold text-slate-900">
          Preparing Password Reset
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Please wait while we load your password-reset form.
        </p>
      </section>
    </main>
  );
}

/**
 * Resolve request-time search parameters inside Suspense.
 */
async function ResetPasswordContent({
  searchParams,
}: ResetPasswordPageProps) {
  const query = await searchParams;

  const uid =
    typeof query.uid === "string" ? query.uid : "";

  const token =
    typeof query.token === "string" ? query.token : "";

  if (!uid || !token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Invalid Reset Link
          </h1>

          <p className="mt-3 text-sm text-slate-600">
            The password-reset link is incomplete or invalid.
            Please request a new reset email.
          </p>

          <Link
            href="/forgot-password"
            className="mt-6 inline-flex w-full justify-center rounded-xl bg-[#1E3A8A] px-5 py-3 text-sm font-semibold text-white hover:bg-[#3B82F6]"
          >
            Request New Reset Link
          </Link>
        </section>
      </main>
    );
  }

  return <ResetPasswordForm uid={uid} token={token} />;
}

export default function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordContent searchParams={searchParams} />
    </Suspense>
  );
}
