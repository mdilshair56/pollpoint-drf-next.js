"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeading } from "@/components/common/page-heading";
import { adminService, type AdminInvitation } from "@/services/admin-service";
import { getErrorMessage } from "@/utils/errors";

function dateLabel(value: string) {
  return new Date(value).toLocaleString();
}

export function InvitationsPanel() {
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await adminService.invitations();
      setInvitations(result.data);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  async function sendInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await adminService.invite(email.trim());
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
      <PageHeading eyebrow="Invitations" title="Invite a user" description="Send an invitation to join Pollpoint and track its status." />
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      <section className="panel mt-7 p-5 sm:p-6">
        <h2 className="text-lg font-bold text-brand">Send an invitation</h2>
        <p className="mt-1 text-sm text-muted">The invitation email contains a secure link that expires after 24 hours. The recipient can accept or decline.</p>
        <form onSubmit={sendInvite} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input className="field min-w-0 flex-1" type="email" required placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          <button className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send invitation"}</button>
        </form>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold text-brand">Your invitations</h2><button className="btn-secondary text-sm" onClick={() => void load()}>Refresh</button></div>
        {loading ? <p className="text-sm text-muted">Loading invitations…</p> : invitations.length === 0 ? <div className="panel p-5 text-sm text-muted">No invitations yet.</div> : (
          <div className="panel divide-y divide-border">
            {invitations.map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div><p className="font-semibold text-ink">{invitation.email}</p><p className="mt-1 text-xs text-muted">Sent {dateLabel(invitation.created_at)} · Expires {dateLabel(invitation.expires_at)}</p></div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">{invitation.status}</span>
            </div>)}
          </div>
        )}
      </section>
    </div>
  );
}
