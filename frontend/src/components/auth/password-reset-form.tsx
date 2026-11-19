"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { notify } from "@/lib/notifications";
import { authService } from "@/services/auth-service";
import { getErrorMessage } from "@/utils/errors";

export function PasswordResetForm() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid") ?? undefined;
  const token = searchParams.get("token") ?? undefined;
  const hasResetToken = Boolean(uid && token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);

    try {
      if (hasResetToken) {
        await notify.promise(
          authService.confirmPasswordReset({
            uid: uid as string,
            token: token as string,
            new_password: String(form.get("new_password")),
            confirm_password: String(form.get("confirm_password")),
          }),
          {
            loading: "Updating password...",
            success: "Password updated successfully!",
            error: "Unable to update password.",
          }
        );
        setMessage("Your password has been changed. You can now sign in.");
      } else {
        await notify.promise(
          authService.requestPasswordReset({ email: String(form.get("email")).trim() }),
          {
            loading: "Sending reset link...",
            success: "Password reset link sent!",
            error: "Unable to send reset link.",
          }
        );
        setMessage("If the request was accepted, a password reset email has been sent.");
      }
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel w-full max-w-md p-7 sm:p-9">
      <Link href="/login" className="text-sm font-bold text-brand">← Back to sign in</Link>
      <h1 className="mt-6 text-2xl font-bold text-brand">{hasResetToken ? "Choose a new password" : "Reset your password"}</h1>
      <p className="mt-2 text-sm text-muted">{hasResetToken ? "Enter and confirm your new password." : "Enter the email address registered to your account."}</p>
      {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={submit} className="mt-6 space-y-4">
        {hasResetToken ? (
          <>
            <div><label className="field-label" htmlFor="new_password">New password</label><input className="field" id="new_password" name="new_password" type="password" minLength={8} required autoComplete="new-password" /></div>
            <div><label className="field-label" htmlFor="confirm_password">Confirm password</label><input className="field" id="confirm_password" name="confirm_password" type="password" required autoComplete="new-password" /></div>
          </>
        ) : (
          <div><label className="field-label" htmlFor="email">Email address</label><input className="field" id="email" name="email" type="email" required autoComplete="email" /></div>
        )}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Please wait…" : hasResetToken ? "Update password" : "Send reset link"}</button>
      </form>
    </section>
  );
}
