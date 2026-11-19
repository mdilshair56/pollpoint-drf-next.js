"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { notify } from "@/lib/notifications";
import { adminService } from "@/services/admin-service";
import { authService } from "@/services/auth-service";
import { getErrorMessage } from "@/utils/errors";

export function InvitationResponse() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const [email, setEmail] = useState("");
  const [inviter, setInviter] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) return;
    adminService.previewInvitation(token)
      .then((result) => { setEmail(result.data.email); setInviter(result.data.invited_by); })
      .catch((caught) => setError(getErrorMessage(caught)));
    authService.getCurrentUser().then(() => setAuthenticated(true)).catch(() => setAuthenticated(false));
  }, [token]);

  async function respond(decision: "accept" | "decline") {
    setBusy(true);
    setError("");
    setMessage("");
    const isAccept = decision === "accept";
    try {
      const result = await notify.promise(
        adminService.respondInvitation(token, decision),
        {
          loading: isAccept ? "Accepting invitation..." : "Declining invitation...",
          success: isAccept ? "Invitation accepted!" : "Invitation declined.",
          error: isAccept ? "Unable to accept invitation." : "Unable to decline invitation.",
        }
      );
      setMessage(result.message);
      if (decision === "accept") router.push("/dashboard");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <section className="panel w-full max-w-lg p-7 sm:p-9">
        <Link href="/" className="text-sm font-bold text-brand">← Pollpoint</Link>
        <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-interactive">Invitation</p>
        <h1 className="mt-2 text-3xl font-bold text-brand">You’re invited</h1>
        {email && <p className="mt-4 text-sm text-muted">{inviter} invited <strong className="text-ink">{email}</strong> to join Pollpoint.</p>}
        {(error || !token) && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error || "Invitation token is missing."}</p>}
        {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        {email && !message && (
          authenticated ? (
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn-primary" disabled={busy} onClick={() => void respond("accept")}>{busy ? "Please wait…" : "Accept invitation"}</button>
              <button className="btn-secondary" disabled={busy} onClick={() => void respond("decline")}>Decline</button>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-muted">Sign in with this email address to accept, or decline without signing in.</p>
              <Link className="btn-primary inline-flex" href={"/login?next=" + encodeURIComponent("/invitations/respond?token=" + token)}>Sign in to accept</Link>
              <Link className="ml-3 inline-flex text-sm font-semibold text-interactive" href={"/register?email=" + encodeURIComponent(email) + "&next=" + encodeURIComponent("/invitations/respond?token=" + token)}>Create account</Link>
              <div><button className="text-sm font-semibold text-muted underline" disabled={busy} onClick={() => void respond("decline")}>Decline invitation</button></div>
            </div>
          )
        )}
      </section>
    </main>
  );
}
