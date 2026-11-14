"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authService } from "@/services/auth-service";
import type { User } from "@/types/auth";

export function ProtectedArea({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authService.getCurrentUser()
      .then((response) => {
        if (active) setUser(response.data);
      })
      .catch(() => {
        if (active) router.replace("/login");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [router]);

  async function handleLogout() {
    try {
      await authService.logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <div className="mx-auto size-9 animate-spin rounded-full border-4 border-blue-100 border-t-interactive" />
          <p className="mt-4 text-sm text-slate-500">Checking your session…</p>
        </div>
      </main>
    );
  }

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;
  const canManageUsers = user.is_superuser || user.role === "admin" || user.role === "superadmin";

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur">
        <div className="page-shell flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
          <Link href="/dashboard" className="text-xl font-bold tracking-tight text-brand">Pollpoint</Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Link href="/dashboard" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-blue-50 hover:text-brand">Overview</Link>
            <Link href="/polls" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-blue-50 hover:text-brand">Polls</Link>
            {canManageUsers && (
              <Link href="/users" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-blue-50 hover:text-brand">Users</Link>
            )}
            <Link href="/invitations" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-blue-50 hover:text-brand">Invitations</Link>
            <Link href="/profile" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-blue-50 hover:text-brand">Profile</Link>
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-ink">{displayName}</p>
              <p className="text-xs capitalize text-muted">{user.role}</p>
            </div>
            <button onClick={handleLogout} className="btn-secondary text-sm">Log out</button>
          </div>
        </div>
      </header>
      <main className="page-shell py-8">{children}</main>
    </div>
  );
}
