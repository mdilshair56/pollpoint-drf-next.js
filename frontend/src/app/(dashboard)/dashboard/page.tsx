"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeading } from "@/components/common/page-heading";
import { pollService } from "@/services/poll-service";
import type { PollSummary } from "@/types/poll";
import { getErrorMessage } from "@/utils/errors";
export default function DashboardPage() {
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pollService.list({ page: 1, page_size: 5, ordering: "-created_at" })
      .then((result) => {
        setPolls(result.polls);
        setCount(result.pagination.count);
      })
      .catch((caught) => setError(getErrorMessage(caught)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeading
        eyebrow="Workspace"
        title="Dashboard"
        description="A quick overview of the polls available to your account."
        actions={<Link href="/polls" className="btn-primary">Browse polls</Link>}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="panel p-5"><p className="text-sm font-semibold text-muted">Visible polls</p><p className="mt-2 text-3xl font-bold text-brand">{loading ? "—" : count}</p><p className="mt-1 text-sm text-muted">Based on the current account’s poll visibility rules.</p></section>
        <section className="panel p-5"><p className="text-sm font-semibold text-muted">Quick action</p><h2 className="mt-2 text-xl font-bold text-brand">Explore the polls</h2><p className="mt-1 text-sm text-muted">Open a poll to view its questions and cast your vote.</p><Link href="/polls" className="mt-4 inline-flex text-sm font-semibold text-interactive hover:underline">Go to polls →</Link></section>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-brand">Recently created</h2><Link href="/polls" className="text-sm font-semibold text-interactive hover:underline">View all</Link></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading ? <p className="text-sm text-muted">Loading polls…</p> : polls.length === 0 ? <div className="panel p-6 text-sm text-muted">No polls are currently visible to this account.</div> : (
          <div className="panel divide-y divide-border">
            {polls.map((poll) => <Link key={poll.id} href={"/polls/" + poll.id} className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50"><div><p className="font-semibold text-ink">{poll.name}</p><p className="mt-1 text-xs text-muted">Created by {[poll.created_by.first_name, poll.created_by.last_name].filter(Boolean).join(" ") || "Unknown"}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-brand">{poll.status.replace("_", " ")}</span></Link>)}
          </div>
        )}
      </section>
    </div>
  );
}
