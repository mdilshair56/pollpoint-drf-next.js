"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { notify } from "@/lib/notifications";
import { resetPassword } from "@/services/password-reset-service";
import { getErrorMessage } from "@/utils/errors";

interface ResetPasswordFormProps {
  uid: string;
  token: string;
}

export default function ResetPasswordForm({
  uid,
  token,
}: ResetPasswordFormProps) {
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordsMatch = newPassword === confirmPassword;

  const showMismatch =
    confirmPassword.length > 0 && !passwordsMatch;

  useEffect(() => {
    if (!success) return;

    const timer = window.setTimeout(() => {
      router.replace("/login");
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [success, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");

    if (!newPassword || !confirmPassword) {
      setErrorMessage("Please fill in both password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await notify.promise(
        resetPassword({
          uid,
          token,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }).then((res) => {
          if (res && res.success === false) {
            throw new Error(res.message || "Unable to reset password.");
          }
          return res;
        }),
        {
          loading: "Resetting password...",
          success: "Password reset successfully!",
          error: "Unable to reset password.",
        }
      );

      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);

    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));

    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <section
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
          aria-live="polite"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700">
            ✓
          </div>

          <h1 className="mt-6 text-2xl font-bold text-slate-900">
            Password Reset Successful!
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your password has been updated successfully.
            You can now log in using your new password.
          </p>

          <p className="mt-5 text-sm text-slate-500">
            Redirecting you to login...
          </p>

          <Link
            href="/login"
            className="mt-6 inline-flex w-full justify-center rounded-xl bg-[#1E3A8A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3B82F6]"
          >
            Go to Login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl text-[#1E3A8A]">
            🔐
          </div>

          <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
            Reset Your Password
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Enter your new password and confirm it to
            regain access to your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* New password */}
          <div>
            <label
              htmlFor="new-password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              New Password
            </label>

            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter new password (min. 8 characters)"
                value={newPassword}
                minLength={8}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setErrorMessage("");
                }}
                disabled={isSubmitting}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-16 text-sm text-slate-900 outline-none transition focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((previous) => !previous)
                }
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#1E3A8A] hover:underline"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label
              htmlFor="confirm-password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Confirm New Password
            </label>

            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={confirmPassword}
                minLength={8}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setErrorMessage("");
                }}
                disabled={isSubmitting}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-16 text-sm text-slate-900 outline-none transition focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword((previous) => !previous)
                }
                aria-label={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#1E3A8A] hover:underline"
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>

            {showMismatch && (
              <p className="mt-2 text-xs text-red-600" aria-live="polite">
                Passwords do not match.
              </p>
            )}

            {confirmPassword.length > 0 && passwordsMatch && (
              <p className="mt-2 text-xs text-green-700" aria-live="polite">
                Passwords match.
              </p>
            )}
          </div>

          {/* Backend error */}
          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {errorMessage}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !newPassword ||
              !confirmPassword ||
              !passwordsMatch
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#3B82F6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Resetting Password...
              </>
            ) : (
              "Reset Password"
            )}
          </button>
        </form>

        <div className="mt-7 border-t border-slate-100 pt-5 text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-[#1E3A8A] hover:underline"
          >
            Back to Login
          </Link>
        </div>
      </section>
    </main>
  );
}
