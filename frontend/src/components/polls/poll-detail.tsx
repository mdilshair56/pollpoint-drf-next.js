"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pollService } from "@/services/poll-service";
import type { PollDetail as PollDetailType } from "@/types/poll";
import { getErrorMessage } from "@/utils/errors";
import VoteSection from "@/components/polls/vote-section";

function displayDate(value: string | null): string {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function toLocalDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" +
    pad(date.getDate()) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

export function PollDetailView({ pollId }: { pollId: number }) {
  const router = useRouter();
  const [poll, setPoll] = useState<PollDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [newEndAt, setNewEndAt] = useState("");

  useEffect(() => {
    const initialClock = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    const clockInterval = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => {
      window.clearTimeout(initialClock);
      window.clearInterval(clockInterval);
    };
  }, []);

  useEffect(() => {
    let active = true;
    pollService.getById(pollId)
      .then((response) => {
        if (!active) return;
        setPoll(response.data);
        setNewEndAt(toLocalDateTime(response.data.ends_at));
      })
      .catch((caught) => { if (active) setError(getErrorMessage(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pollId]);

  // Keep the displayed status in sync with the backend after Celery completes a poll.
  const activePollId = poll?.id;
  const activePollStatus = poll?.status;

  useEffect(() => {
    if (!activePollId || activePollStatus !== "in_progress") return;

    let active = true;
    const refreshPoll = async () => {
      try {
        const response = await pollService.getById(activePollId);
        if (active) setPoll(response.data);
      } catch {
        // Keep the last successfully loaded poll visible if a background refresh fails.
      }
    };

    const interval = window.setInterval(() => {
      void refreshPoll();
    }, 15_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [activePollId, activePollStatus]);

  async function publishPoll() {
    if (!poll) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      // const result = await pollService.publish(poll.id);
      const result = await pollService.publishDraft(poll.id);
      setPoll(result.data);
      setMessage(result.message ?? "Poll published successfully.");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function closePoll() {
    if (!poll || !window.confirm("Close this poll now? Voting will stop immediately.")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await pollService.close(poll.id);
      setPoll(result.data);
      setMessage(result.message ?? "Poll closed successfully.");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function extendPoll(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!poll || !newEndAt) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await pollService.extend(poll.id, new Date(newEndAt).toISOString());
      setPoll(result.data);
      setNewEndAt(toLocalDateTime(result.data.ends_at));
      setMessage(result.message ?? "Poll end date extended.");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function deletePoll() {
    if (!poll || !window.confirm("Permanently delete this poll and its associated questions and votes? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    try {
      await pollService.delete(poll.id);
      router.push("/polls");
      router.refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
      setBusy(false);
    }
  }

  if (loading) return <div className="panel p-8 text-sm text-muted">Loading poll…</div>;
  if (error && !poll) return <div><Link href="/polls" className="text-sm font-semibold text-interactive">← Back to polls</Link><p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p></div>;
  if (!poll) return null;

  const creator = [poll.created_by.first_name, poll.created_by.last_name].filter(Boolean).join(" ") || "Unknown";
  const now = currentTime ?? 0;
  const startsAt = poll.starts_at ? new Date(poll.starts_at).getTime() : 0;
  const endsAt = poll.ends_at ? new Date(poll.ends_at).getTime() : Number.POSITIVE_INFINITY;
  const canVote = poll.status === "in_progress" && now >= startsAt && now < endsAt;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/polls" className="text-sm font-semibold text-interactive hover:underline">← Back to polls</Link>
      <section className="panel mt-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={"rounded-full px-3 py-1 text-xs font-semibold capitalize " + (poll.status === "draft" ? "bg-amber-50 text-amber-700" : poll.status === "completed" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700")}>{poll.status.replace("_", " ")}</span>
          <span className="text-xs text-muted">Created by {creator}</span>
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-brand">{poll.name}</h1>
        {poll.description && <p className="mt-3 leading-7 text-slate-600">{poll.description}</p>}
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
          <span className="rounded-lg bg-slate-100 px-3 py-2"><strong className="font-semibold text-slate-700">Starts:</strong> {displayDate(poll.starts_at)}</span>
          <span className="rounded-lg bg-slate-100 px-3 py-2"><strong className="font-semibold text-slate-700">Ends:</strong> {displayDate(poll.ends_at)}</span>
        </div>
        {/* {poll.can_manage && (
          <div className="mt-5 rounded-xl border border-border bg-slate-50 p-4">
            <p className="font-semibold text-brand">Poll management</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={"/polls/" + poll.id + "/edit"} className="btn-primary">Edit poll</Link>
              {poll.status === "draft" && <button type="button" className="btn-accent" disabled={busy} onClick={publishPoll}>{busy ? "Publishing…" : "Publish poll"}</button>}
              {poll.status === "in_progress" && <button type="button" className="btn-secondary" disabled={busy} onClick={closePoll}>Close poll now</button>}
              <button type="button" className="btn-secondary text-red-600" disabled={busy} onClick={deletePoll}>Delete poll</button>
            </div>
            {poll.status === "in_progress" && (
              <form onSubmit={extendPoll} className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
                <div className="min-w-0 flex-1">
                  <label className="field-label" htmlFor="extend-ends-at">Extend voting until</label>
                  <input className="field" id="extend-ends-at" type="datetime-local" required value={newEndAt} onChange={(event) => setNewEndAt(event.target.value)} />
                </div>
                <button type="submit" className="btn-accent" disabled={busy}>Extend poll</button>
              </form>
            )}
          </div>
        )} */}
        {poll.status === "draft" && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">Draft — voting has not opened.</p>
            <p className="mt-1 text-sm text-amber-800">Review this draft before publishing it.</p>
            {poll.can_manage && (
              <button
                type="button"
                className="btn-primary mt-4"
                disabled={busy}
                onClick={publishPoll}
              >
                {busy ? "Publishing…" : "Publish"}
              </button>
            )}
          </div>
        )}
        {poll.status === "completed" && (
          <p className="mt-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">This poll is completed. Voting is closed.</p>
        )}
        {poll.status === "in_progress" && now < startsAt && (
          <p className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">Published — voting opens on {displayDate(poll.starts_at)}.</p>
        )}
        {poll.status === "in_progress" && now >= endsAt && (
          <p className="mt-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">This poll has reached its end time. Voting is closed.</p>
        )}
      </section>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      <VoteSection key={poll.id} poll={poll} canVote={canVote} />
    </div>
  );
}
