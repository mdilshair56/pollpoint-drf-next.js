"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { notify } from "@/lib/notifications";
import { authService } from "@/services/auth-service";
import type { User } from "@/types/auth";
import {
  Menu,
  X,
  LayoutDashboard,
  Vote,
  BarChart3,
  Users,
  Mail,
  UserCheck,
  LogOut,
} from "lucide-react";

export function ProtectedArea({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentPath(window.location.pathname);
    }
  }, []);

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
      await notify.promise(authService.logout(), {
        loading: "Signing out...",
        success: "Signed out successfully!",
        error: "Unable to sign out.",
      });
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

  const navLinks = [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { label: "Polls", href: "/polls", icon: Vote },
    { label: "Poll Results", href: "/polls/results", icon: BarChart3 },
    ...(canManageUsers ? [{ label: "Users", href: "/users", icon: Users }] : []),
    { label: "Invitations", href: "/invitations", icon: Mail },
    { label: "Profile", href: "/profile", icon: UserCheck },
  ];

  const isActive = (href: string) => {
    if (!currentPath) return false;
    if (href === "/polls") return currentPath === "/polls";
    return currentPath.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur-md">
        <div className="page-shell flex min-h-16 items-center justify-between gap-3 py-3">
          {/* Brand Logo */}
          <Link href="/dashboard" className="text-xl font-extrabold tracking-tight text-brand flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-interactive text-white flex items-center justify-center text-sm font-black shadow-sm">
              P
            </span>
            <span>Pollpoint</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-semibold">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setCurrentPath(link.href)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition-colors ${
                    active
                      ? "bg-blue-50 text-interactive font-bold"
                      : "text-slate-600 hover:bg-slate-100/70 hover:text-brand"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User profile & Mobile Menu Trigger */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:block text-right">
              <p className="text-sm font-semibold text-ink leading-tight">{displayName}</p>
              <p className="text-xs capitalize text-muted">{user.role}</p>
            </div>
            
            <button
              onClick={handleLogout}
              className="hidden sm:inline-flex btn-secondary text-xs sm:text-sm items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>

            {/* Hamburger Button for Mobile */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-white px-4 pt-3 pb-6 shadow-xl animate-in slide-in-from-top-2 duration-200">
            {/* User Profile summary on mobile */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-4 border border-slate-100">
              <div className="w-9 h-9 rounded-full bg-interactive text-white flex items-center justify-center font-bold text-sm shadow-sm">
                {displayName[0]?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink truncate">{displayName}</p>
                <p className="text-xs text-muted capitalize">{user.role}</p>
              </div>
            </div>

            {/* Nav Links */}
            <div className="space-y-1">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => {
                      setCurrentPath(link.href);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      active
                        ? "bg-blue-50 text-interactive font-bold"
                        : "text-slate-700 hover:bg-slate-50 hover:text-brand"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Mobile Logout Button */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="page-shell py-8 flex-1">{children}</main>
    </div>
  );
}
