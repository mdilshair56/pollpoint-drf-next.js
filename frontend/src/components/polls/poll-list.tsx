"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeading } from "@/components/common/page-heading";
import { notify } from "@/lib/notifications";
import { pollService } from "@/services/poll-service";
import type { PollFilters, PollSummary } from "@/types/poll";
import type { PaginationMeta } from "@/types/api";
import { getErrorMessage } from "@/utils/errors";

const emptyPagination: PaginationMeta = {
  count: 0, next: null, previous: null, page: 1, page_size: 10, total_pages: 1,
};

function asIsoDate(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function PollList() {
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(emptyPagination);
  const [filters, setFilters] = useState<PollFilters>({ page: 1, page_size: 10, ordering: "-created_at" });
  const [formKey, setFormKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [publishingPollId, setPublishingPollId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    pollService.list(filters)
      .then((result) => {
        if (!active) return;
        setError("");
        setPolls(result.polls);
        setPagination(result.pagination);
      })
      .catch((caught) => {
        if (active) setError(getErrorMessage(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [filters]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    setFilters({
      page: 1,
      page_size: 10,
      search: String(form.get("search") ?? "").trim() || undefined,
      status: String(form.get("status") ?? "") as PollFilters["status"],
      result_visibility: String(form.get("result_visibility") ?? "") as PollFilters["result_visibility"],
      ordering: (String(form.get("ordering") ?? "-created_at") || "-created_at") as PollFilters["ordering"],
      created_after: asIsoDate(form.get("created_after")),
      created_before: asIsoDate(form.get("created_before")),
      starts_after: asIsoDate(form.get("starts_after")),
      starts_before: asIsoDate(form.get("starts_before")),
      ends_after: asIsoDate(form.get("ends_after")),
      ends_before: asIsoDate(form.get("ends_before")),
    });
  }

  function changePage(nextPage: number) {
    setLoading(true);
    setFilters((current) => ({ ...current, page: nextPage }));
  }

  async function publishDraft(pollId: number) {
    if (!window.confirm("Publish this draft poll now?")) return;

    setPublishingPollId(pollId);
    setError("");
    try {
      await notify.promise(pollService.publishDraft(pollId), {
        loading: "Publishing poll...",
        success: "Poll published successfully!",
        error: "Unable to publish poll.",
      });
      const refreshed = await pollService.list(filters);
      setPolls(refreshed.polls);
      setPagination(refreshed.pagination);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setPublishingPollId(null);
    }
  }

  function clearFilters() {
    setLoading(true);
    setFormKey((current) => current + 1);
    setFilters({ page: 1, page_size: 10, ordering: "-created_at" });
  }

  return (
    <div>
      <PageHeading
        eyebrow="Poll workspace"
        title="Polls"
        description="Search, filter, sort and open polls visible to your account."
        actions={<Link href="/polls/new" className="btn-primary">Create a poll</Link>}
      />

      <form key={formKey} onSubmit={applyFilters} className="panel mt-7 space-y-4 p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2"><label className="field-label" htmlFor="search">Search name or description</label><input className="field" id="search" name="search" placeholder="Search polls…" defaultValue={filters.search ?? ""} /></div>
          <div><label className="field-label" htmlFor="status">Status</label><select className="field" id="status" name="status" defaultValue={filters.status ?? ""}><option value="">All statuses</option><option value="draft">Draft</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></div>
          <div><label className="field-label" htmlFor="result_visibility">Result visibility</label><select className="field" id="result_visibility" name="result_visibility" defaultValue={filters.result_visibility ?? ""}><option value="">All visibility types</option><option value="live">Live</option><option value="after_submission">After submission</option><option value="polls_end">After poll ends</option><option value="restricted">Restricted</option></select></div>
          <div><label className="field-label" htmlFor="ordering">Order by</label><select className="field" id="ordering" name="ordering" defaultValue={filters.ordering ?? "-created_at"}><option value="-created_at">Newest first</option><option value="created_at">Oldest first</option><option value="name">Name A–Z</option><option value="-name">Name Z–A</option><option value="starts_at">Start date (earliest)</option><option value="-starts_at">Start date (latest)</option><option value="ends_at">End date (earliest)</option><option value="-ends_at">End date (latest)</option></select></div>
        </div>
        <details className="rounded-lg border border-border px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-brand">Advanced date filters</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><label className="field-label" htmlFor="created_after">Created after</label><input className="field" id="created_after" name="created_after" type="datetime-local" /></div>
            <div><label className="field-label" htmlFor="created_before">Created before</label><input className="field" id="created_before" name="created_before" type="datetime-local" /></div>
            <div><label className="field-label" htmlFor="starts_after">Starts after</label><input className="field" id="starts_after" name="starts_after" type="datetime-local" /></div>
            <div><label className="field-label" htmlFor="starts_before">Starts before</label><input className="field" id="starts_before" name="starts_before" type="datetime-local" /></div>
            <div><label className="field-label" htmlFor="ends_after">Ends after</label><input className="field" id="ends_after" name="ends_after" type="datetime-local" /></div>
            <div><label className="field-label" htmlFor="ends_before">Ends before</label><input className="field" id="ends_before" name="ends_before" type="datetime-local" /></div>
          </div>
        </details>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={clearFilters}>Clear filters</button>
          <button type="submit" className="btn-primary">Apply filters</button>
        </div>
      </form>

      <div className="mb-3 mt-7 flex items-center justify-between"><h2 className="text-lg font-bold text-brand">Results</h2><span className="text-sm text-muted">{pagination.count} poll(s)</span></div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <div className="panel p-8 text-center text-sm text-muted">Loading polls…</div> : polls.length === 0 ? <div className="panel p-8 text-center"><h3 className="font-semibold text-brand">No matching polls</h3><p className="mt-1 text-sm text-muted">Try changing your search or filters.</p></div> : (
        <div className="panel divide-y divide-border">
          {polls.map((poll) => (
            <div key={poll.id} className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:bg-slate-50">
              <Link href={"/polls/" + poll.id} className="min-w-0 flex-1">
                <h3 className="font-semibold text-ink">{poll.name}</h3>
                <p className="mt-1 text-sm text-muted">Created by {[poll.created_by.first_name, poll.created_by.last_name].filter(Boolean).join(" ") || "Unknown"}</p>
                <span className={"mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize " + (poll.status === "in_progress" ? "bg-emerald-50 text-emerald-700" : poll.status === "completed" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700")}>{poll.status.replace("_", " ")}</span>
              </Link>
              {poll.can_manage && poll.status === "draft" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={"/polls/" + poll.id + "/edit"} className="btn-secondary whitespace-nowrap">
                    Continue editing
                  </Link>
                  <button
                    type="button"
                    className="btn-primary whitespace-nowrap"
                    disabled={publishingPollId === poll.id}
                    onClick={() => publishDraft(poll.id)}
                  >
                    {publishingPollId === poll.id ? "Publishing…" : "Publish"}
                  </button>
                </div>
              ) : (
                <Link href={"/polls/" + poll.id} className="btn-secondary whitespace-nowrap">View poll</Link>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <button type="button" className="btn-secondary" disabled={loading || pagination.page <= 1} onClick={() => changePage(Math.max(1, (filters.page ?? 1) - 1))}>← Previous</button>
        <span className="text-sm text-muted">Page {pagination.page} of {Math.max(1, pagination.total_pages)}</span>
        <button type="button" className="btn-secondary" disabled={loading || pagination.page >= pagination.total_pages} onClick={() => changePage((filters.page ?? 1) + 1)}>Next →</button>
      </div>
    </div>
  );
}
