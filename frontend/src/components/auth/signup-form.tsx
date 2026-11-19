"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { notify } from "@/lib/notifications";
import { authService } from "@/services/auth-service";
import { getErrorMessage } from "@/utils/errors";

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const profileFields = ["father_name", "date_of_birth", "address", "city", "state", "country"] as const;
    const profile = Object.fromEntries(profileFields
      .map((field) => [field, String(form.get(field) ?? "").trim()])
      .filter(([, value]) => value !== "")) as Record<string, string>;

    try {
      await notify.promise(
        authService.signup({
          username: String(form.get("username")).trim(),
          first_name: String(form.get("first_name")).trim(),
          last_name: String(form.get("last_name")).trim(),
          email: String(form.get("email")).trim(),
          phone_number: String(form.get("phone_number")).trim() || undefined,
          password: String(form.get("password")),
          ...(Object.keys(profile).length ? { profile } : {}),
        }),
        {
          loading: "Creating account...",
          success: "Account created successfully!",
          error: "Unable to create account.",
        }
      );
      const next = searchParams.get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "";
      router.push("/login?registered=1" + (safeNext ? "&next=" + encodeURIComponent(safeNext) : ""));
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel w-full max-w-2xl p-7 sm:p-9">
      <Link href="/" className="text-sm font-bold text-brand">← Pollpoint</Link>
      <div className="mt-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-interactive">Get started</p>
        <h1 className="mt-2 text-3xl font-bold text-brand">Create your account</h1>
        <p className="mt-2 text-sm text-muted">Your account will be created with the Client role.</p>
      </div>

      {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <form onSubmit={submit} className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="field-label" htmlFor="first_name">First name</label><input className="field" id="first_name" name="first_name" required /></div>
          <div><label className="field-label" htmlFor="last_name">Last name</label><input className="field" id="last_name" name="last_name" required /></div>
          <div><label className="field-label" htmlFor="username">Username</label><input className="field" id="username" name="username" autoComplete="username" required /></div>
          <div><label className="field-label" htmlFor="email">Email</label><input className="field" id="email" name="email" type="email" autoComplete="email" defaultValue={searchParams.get("email") ?? ""} required /></div>
          <div><label className="field-label" htmlFor="phone_number">Phone number</label><input className="field" id="phone_number" name="phone_number" type="tel" /></div>
          <div><label className="field-label" htmlFor="password">Password</label><input className="field" id="password" name="password" type="password" minLength={8} autoComplete="new-password" required /></div>
        </div>

        <details className="rounded-xl border border-border p-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand">Optional profile information</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><label className="field-label" htmlFor="father_name">Father’s name</label><input className="field" id="father_name" name="father_name" /></div>
            <div><label className="field-label" htmlFor="date_of_birth">Date of birth</label><input className="field" id="date_of_birth" name="date_of_birth" type="date" /></div>
            <div className="sm:col-span-2"><label className="field-label" htmlFor="address">Address</label><textarea className="field" id="address" name="address" rows={2} /></div>
            <div><label className="field-label" htmlFor="city">City</label><input className="field" id="city" name="city" /></div>
            <div><label className="field-label" htmlFor="state">State / Province</label><input className="field" id="state" name="state" /></div>
            <div><label className="field-label" htmlFor="country">Country</label><input className="field" id="country" name="country" /></div>
          </div>
        </details>

        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">Already registered? <Link href="/login" className="font-semibold text-interactive hover:underline">Sign in</Link></p>
    </section>
  );
}
