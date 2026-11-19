"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeading } from "@/components/common/page-heading";
import { notify } from "@/lib/notifications";
import {
  adminService,
  type AdminInvitation,
} from "@/services/admin-service";
import { getErrorMessage } from "@/utils/errors";

function dateLabel(value: string) {
  return new Date(value).toLocaleString();
}

export function AdminPanel() {
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const invitationResult = await adminService.invitations();
      setInvitations(invitationResult.data);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function sendInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await notify.promise(
        adminService.invite(email.trim()),
        {
          loading: "Sending invitation...",
          success: "Invitation sent successfully!",
          error: "Unable to send invitation.",
        }
      );

      setMessage(result.message);
      setEmail("");

      await load();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeading
        eyebrow="Administration"
        title="Admin centre"
        description="Manage invitations and invite new users to Pollpoint."
      />

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {message}
        </p>
      )}

      {/* Invite User */}
      <section className="panel mt-7 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-brand">
          Invite a user
        </h2>

        <p className="mt-1 text-sm text-muted">
          An invitation email contains a secure link that expires
          after 24 hours. The recipient can accept or decline.
        </p>

        <form
          onSubmit={sendInvite}
          className="mt-4 flex flex-col gap-3 sm:flex-row"
        >
          <input
            className="field min-w-0 flex-1"
            type="email"
            required
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <button
            type="submit"
            className="btn-primary"
            disabled={busy}
          >
            {busy ? "Sending…" : "Send invitation"}
          </button>
        </form>
      </section>

      {/* Invitations List */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand">
            Invitations
          </h2>

          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => void load()}
            disabled={busy}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-muted">
            Loading invitations…
          </p>
        ) : invitations.length === 0 ? (
          <div className="panel p-5 text-sm text-muted">
            No invitations yet.
          </div>
        ) : (
          <div className="panel divide-y divide-border">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-semibold text-ink">
                    {invitation.email}
                  </p>

                  <p className="mt-1 text-xs text-muted">
                    Sent {dateLabel(invitation.created_at)}
                    {" · "}
                    Expires {dateLabel(invitation.expires_at)}
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                  {invitation.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
