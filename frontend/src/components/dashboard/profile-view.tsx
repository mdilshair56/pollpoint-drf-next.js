"use client";

import { useEffect, useState } from "react";
import { PageHeading } from "@/components/common/page-heading";
import { notify } from "@/lib/notifications";
import { authService } from "@/services/auth-service";
import type { UpdateProfilePayload, UserProfile } from "@/types/auth";
import { getErrorMessage } from "@/utils/errors";

export function ProfileView() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<UpdateProfilePayload>({
    father_name: "",
    date_of_birth: "",
    address: "",
    city: "",
    state: "",
    country: "",
  });

  useEffect(() => {
    let active = true;
    authService.getMyProfile()
      .then((result) => {
        if (active) {
          setProfile(result);
          setFormData({
            father_name: result.father_name || "",
            date_of_birth: result.date_of_birth || "",
            address: result.address || "",
            city: result.city || "",
            state: result.state || "",
            country: result.country || "",
          });
        }
      })
      .catch((caught) => { if (active) setError(getErrorMessage(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleStartEdit = () => {
    if (!profile) return;
    setFormData({
      father_name: profile.father_name || "",
      date_of_birth: profile.date_of_birth || "",
      address: profile.address || "",
      city: profile.city || "",
      state: profile.state || "",
      country: profile.country || "",
    });
    setError("");
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (!profile) return;
    setFormData({
      father_name: profile.father_name || "",
      date_of_birth: profile.date_of_birth || "",
      address: profile.address || "",
      city: profile.city || "",
      state: profile.state || "",
      country: profile.country || "",
    });
    setError("");
    setIsEditing(false);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload: UpdateProfilePayload = {
        father_name: formData.father_name?.trim() ?? "",
        date_of_birth: formData.date_of_birth ? formData.date_of_birth : null,
        address: formData.address?.trim() ?? "",
        city: formData.city?.trim() ?? "",
        state: formData.state?.trim() ?? "",
        country: formData.country?.trim() ?? "",
      };

      const updatedProfile = await authService.updateMyProfile(payload);
      setProfile(updatedProfile);
      setFormData({
        father_name: updatedProfile.father_name || "",
        date_of_birth: updatedProfile.date_of_birth || "",
        address: updatedProfile.address || "",
        city: updatedProfile.city || "",
        state: updatedProfile.state || "",
        country: updatedProfile.country || "",
      });
      setIsEditing(false);
      notify.success("Profile details updated successfully.");
    } catch (caught) {
      const msg = getErrorMessage(caught);
      setError(msg);
      notify.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="panel p-8 text-sm text-muted">Loading profile…</div>;
  if (error && !profile) return <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>;
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
        actions={
          !isEditing ? (
            <button
              type="button"
              onClick={handleStartEdit}
              className="btn-secondary text-sm"
            >
              Edit Profile Details
            </button>
          ) : undefined
        }
      />

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="panel mt-6 overflow-hidden">
        <div className="border-b border-border bg-blue-50/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-brand">
                {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.username}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-md border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-brand">
                {user.is_superuser ? "Superadmin" : user.role}
              </span>
              <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-muted">
                @{user.username}
              </span>
            </div>
          </div>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6">
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-800">
              Only your profile details can be edited below. Account credentials (username, email, role) are strictly managed via account settings.
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="father_name" className="field-label">
                  Father’s Name
                </label>
                <input
                  id="father_name"
                  type="text"
                  name="father_name"
                  value={formData.father_name ?? ""}
                  onChange={handleInputChange}
                  placeholder="Enter father's name"
                  className="field"
                />
              </div>

              <div>
                <label htmlFor="date_of_birth" className="field-label">
                  Date of Birth
                </label>
                <input
                  id="date_of_birth"
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth ?? ""}
                  onChange={handleInputChange}
                  className="field"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="address" className="field-label">
                  Address
                </label>
                <textarea
                  id="address"
                  name="address"
                  rows={2}
                  value={formData.address ?? ""}
                  onChange={handleInputChange}
                  placeholder="Enter residential or postal address"
                  className="field resize-none"
                />
              </div>

              <div>
                <label htmlFor="city" className="field-label">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  name="city"
                  value={formData.city ?? ""}
                  onChange={handleInputChange}
                  placeholder="City"
                  className="field"
                />
              </div>

              <div>
                <label htmlFor="state" className="field-label">
                  State / Province
                </label>
                <input
                  id="state"
                  type="text"
                  name="state"
                  value={formData.state ?? ""}
                  onChange={handleInputChange}
                  placeholder="State / Province"
                  className="field"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="country" className="field-label">
                  Country
                </label>
                <input
                  id="country"
                  type="text"
                  name="country"
                  value={formData.country ?? ""}
                  onChange={handleInputChange}
                  placeholder="Country"
                  className="field"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary text-sm"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-x-8 sm:grid-cols-2">
            {values.map(([label, value]) => (
              <div key={label} className="border-b border-border px-5 py-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
                <dd className="mt-1 break-words text-sm font-medium capitalize text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}
