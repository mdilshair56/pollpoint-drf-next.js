"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/common/page-heading";
import { authService } from "@/services/auth-service";
import type { UserProfile } from "@/types/auth";
import { getErrorMessage } from "@/utils/errors";

export function ProfileView() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authService.getMyProfile()
      .then((result) => { if (active) setProfile(result); })
      .catch((caught) => { if (active) setError(getErrorMessage(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="panel p-8 text-sm text-muted">Loading profile…</div>;
  if (error) return <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!profile) return null;

  const user = profile.user;
  const values: [string, string][] = [
    ["Username", user.username],
    ["First name", user.first_name],
    ["Last name", user.last_name],
    ["Email", user.email],
    ["Phone number", user.phone_number ?? "Not provided"],
    ["Role", user.is_superuser ? "Superadmin" : user.role],
    ["Father’s name", profile.father_name || "Not provided"],
    ["Date of birth", profile.date_of_birth || "Not provided"],
    ["Address", profile.address || "Not provided"],
    ["City", profile.city || "Not provided"],
    ["State / Province", profile.state || "Not provided"],
    ["Country", profile.country || "Not provided"],
  ];

  return (
    <div>
      <PageHeading
        eyebrow="Account"
        title="My profile"
        description="User Information"
      />
      <section className="panel mt-6 overflow-hidden">
        <div className="border-b border-border bg-blue-50/70 p-5">
          <h2 className="text-lg font-bold text-brand">{[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username}</h2>
          <p className="mt-1 text-sm text-slate-600">{user.email}</p>
        </div>
        <dl className="grid gap-x-8 sm:grid-cols-2">
          {values.map(([label, value]) => <div key={label} className="border-b border-border px-5 py-4"><dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className="mt-1 break-words text-sm font-medium capitalize text-ink">{value}</dd></div>)}
        </dl>
      </section>
    </div>
  );
}
