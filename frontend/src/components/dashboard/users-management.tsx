"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeading } from "@/components/common/page-heading";
import { notify } from "@/lib/notifications";
import { adminService, type UserListResponse } from "@/services/admin-service";
import type { User, UserRole } from "@/types/auth";
import { getErrorMessage } from "@/utils/errors";

const roles: UserRole[] = ["client", "admin", "superadmin"];

function getUsers(response: UserListResponse): User[] {
  if (Array.isArray(response)) return response;
  if ("results" in response && Array.isArray(response.results)) return response.results;
  if ("data" in response && Array.isArray(response.data)) return response.data;
  return [];
}

export default function UsersManagement() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isSuperadmin = currentUser?.is_superuser === true || currentUser?.role === "superadmin";
  const canViewUsers = Boolean(
    currentUser && (
      currentUser.is_superuser ||
      currentUser.role === "admin" ||
      currentUser.role === "superadmin"
    )
  );

  const loadUsers = useCallback(async () => {
    setError("");
    try {
      const [me, response] = await Promise.all([
        adminService.currentUser(),
        adminService.users(),
      ]);

      setCurrentUser(me);

      const allowed =
        me.is_superuser ||
        me.role === "admin" ||
        me.role === "superadmin";

      if (!allowed) {
        setUsers([]);
        setError("You do not have permission to view registered users.");
        return;
      }

      setUsers(getUsers(response));
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  async function changeRole(user: User, role: UserRole) {
    if (!isSuperadmin || busyUserId !== null || user.role === role) return;

    if (user.is_superuser && role !== "superadmin") {
      const otherSuperadmins = users.filter(
        (item) => item.is_superuser && item.id !== user.id,
      );
      if (otherSuperadmins.length === 0) {
        setError("The last superadmin cannot be demoted.");
        return;
      }
    }

    const confirmed = window.confirm(
      `Change ${user.email}'s role from ${user.role} to ${role}?`,
    );
    if (!confirmed) return;

    setBusyUserId(user.id);
    setError("");
    setMessage("");

    try {
      const result = await notify.promise(
        adminService.promote(user.id, role),
        {
          loading: "Updating role...",
          success: "User role updated successfully!",
          error: "Unable to update role.",
        }
      );
      setMessage(result.message || `Updated ${user.email} to ${role}.`);
      await loadUsers();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusyUserId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading registered users…</p>;
  }

  if (!canViewUsers) {
    return (
      <div className="panel p-6">
        <PageHeading eyebrow="Administration" title="Users" description="Registered Pollpoint accounts." />
        <p role="alert" className="mt-5 text-sm text-red-700">
          {error || "You do not have permission to view users."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Administration"
        title="Users"
        description={
          isSuperadmin
            ? "View registered users and manage their account roles."
            : "View registered users. Role changes are restricted to superadmins."
        }
      />

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="font-bold text-brand">Registered users</h2>
            <p className="mt-1 text-xs text-muted">{users.length} user{users.length === 1 ? "" : "s"}</p>
          </div>
          <button type="button" className="btn-secondary text-sm" onClick={() => void loadUsers()}>
            Refresh
          </button>
        </div>

        {users.length === 0 ? (
          <p className="p-6 text-sm text-muted">No registered users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  {isSuperadmin && <th className="px-4 py-3 font-semibold">Manage role</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => {
                  const isUserSuperadmin = user.is_superuser || user.role === "superadmin";
                  const displayedRole = isUserSuperadmin ? "superadmin" : user.role;
                  const isSelf = user.id === currentUser?.id;
                  const isLastSuperadmin =
                    isUserSuperadmin &&
                    users.filter((item) => item.is_superuser || item.role === "superadmin").length <= 1;

                  return (
                    <tr key={user.id}>
                      <td className="px-4 py-4 font-semibold text-ink">
                        {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username}
                        {isSelf && <span className="ml-2 text-xs font-normal text-muted">(You)</span>}
                      </td>
                      <td className="px-4 py-4 text-muted">{user.email}</td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                          {displayedRole}
                        </span>
                      </td>
                      {isSuperadmin && (
                        <td className="px-4 py-4">
                          <select
                            aria-label={`Change role for ${user.email}`}
                            className="field min-w-36"
                            value={displayedRole}
                            disabled={busyUserId !== null || (isSelf && user.is_superuser) || (isLastSuperadmin && user.is_superuser)}
                            onChange={(event) => void changeRole(user, event.target.value as UserRole)}
                          >
                            {roles.map((role) => (
                              <option key={role} value={role}>
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                              </option>
                            ))}
                          </select>
                          {busyUserId === user.id && <span className="ml-2 text-xs text-muted">Saving…</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
