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

  // Email Change State
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailStep, setEmailStep] = useState<"request" | "verify">("request");
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

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

  // Email Change Handlers
  const handleStartEmailChange = () => {
    setIsChangingEmail(true);
    setEmailStep("request");
    setNewEmail("");
    setOtp("");
    setEmailError("");
  };

  const handleCancelEmailChange = () => {
    setIsChangingEmail(false);
    setEmailStep("request");
    setNewEmail("");
    setOtp("");
    setEmailError("");
  };

  const handleRequestEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setEmailError("Please enter a new email address.");
      return;
    }
    if (profile && cleanEmail === profile.user.email.toLowerCase()) {
      setEmailError("This is already your current email address.");
      return;
    }

    setEmailLoading(true);
    setEmailError("");
    try {
      const response = await authService.requestEmailChange({ email: cleanEmail });
      notify.success(response.message || "A verification code has been sent to your new email.");
      setEmailStep("verify");
    } catch (caught) {
      const msg = getErrorMessage(caught);
      setEmailError(msg);
      notify.error(msg);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setEmailError("OTP must contain exactly six digits.");
      return;
    }

    setEmailLoading(true);
    setEmailError("");
    try {
      const response = await authService.verifyEmailChange({ otp: cleanOtp });
      const updatedEmail = response.data?.email || newEmail.trim().toLowerCase();

      // Update local profile state immediately
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              user: {
                ...prev.user,
                email: updatedEmail,
              },
            }
          : prev
      );

      notify.success("Email address updated successfully.");
      handleCancelEmailChange();
    } catch (caught) {
      const msg = getErrorMessage(caught);
      setEmailError(msg);
      notify.error(msg);
    } finally {
      setEmailLoading(false);
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
          <div className="flex flex-wrap items-center gap-2">
            {!isChangingEmail && (
              <button
                type="button"
                onClick={handleStartEmailChange}
                className="btn-secondary text-sm"
              >
                Change Email
              </button>
            )}
            {!isEditing && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="btn-secondary text-sm"
              >
                Edit Profile Details
              </button>
            )}
          </div>
        }
      />

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Change Email Panel */}
      {isChangingEmail && (
        <section className="panel mt-6 border-blue-200 bg-blue-50/30 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <h3 className="text-base font-bold text-brand">Change Email Address</h3>
              <p className="mt-0.5 text-xs text-muted">
                {emailStep === "request"
                  ? "Enter your new email address to receive a 6-digit verification code."
                  : `Enter the 6-digit verification code sent to ${newEmail}`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancelEmailChange}
              disabled={emailLoading}
              className="text-xs font-semibold text-muted hover:text-ink"
            >
              Close
            </button>
          </div>

          {emailError && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
              {emailError}
            </p>
          )}

          {emailStep === "request" ? (
            <form onSubmit={handleRequestEmailOtp} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="new_email" className="field-label">
                  New Email Address
                </label>
                <input
                  id="new_email"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new.email@example.com"
                  className="field"
                  disabled={emailLoading}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancelEmailChange}
                  disabled={emailLoading}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailLoading || !newEmail.trim()}
                  className="btn-primary text-sm whitespace-nowrap"
                >
                  {emailLoading ? "Sending Code…" : "Send Verification Code"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyEmailOtp} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="email_otp" className="field-label">
                  6-Digit Verification Code
                </label>
                <input
                  id="email_otp"
                  type="text"
                  maxLength={6}
                  pattern="\d{6}"
                  inputMode="numeric"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="field tracking-widest text-center sm:text-left font-mono"
                  disabled={emailLoading}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEmailStep("request");
                    setOtp("");
                    setEmailError("");
                  }}
                  disabled={emailLoading}
                  className="btn-secondary text-sm"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={emailLoading || otp.length !== 6}
                  className="btn-primary text-sm whitespace-nowrap"
                >
                  {emailLoading ? "Verifying…" : "Confirm Change"}
                </button>
              </div>
            </form>
          )}
        </section>
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
              Only your personal profile details can be edited below. Account credentials (username, email, role) are strictly managed via account settings.
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
