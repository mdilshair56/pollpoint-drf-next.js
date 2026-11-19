"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState } from "react";
import { notify } from "@/lib/notifications";
import { authService } from "@/services/auth-service";
import { getErrorMessage } from "@/utils/errors";

type LoginMode = "password" | "otp";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<LoginMode>(searchParams.get("mode") === "otp" ? "otp" : "password");
  const [otpRequested, setOtpRequested] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(searchParams.get("registered") ? "Your account was created. You can log in now." : "");
  const [busy, setBusy] = useState(false);

  function continueAfterLogin() {
    const next = searchParams.get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
    router.refresh();
  }

  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await notify.promise(authService.login({ username, password }), {
        loading: "Signing in...",
        success: "Signed in successfully!",
        error: "Unable to sign in.",
      });
      continueAfterLogin();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function requestOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const response = await notify.promise(authService.requestOtp(email), {
        loading: "Sending login code...",
        success: "Login code sent to your email!",
        error: "Unable to send login code.",
      });
      setOtpRequested(true);
      setMessage(response.detail ?? "A login code has been sent to your email.");
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await notify.promise(authService.verifyOtp(email, otp), {
        loading: "Verifying code...",
        success: "Signed in successfully!",
        error: "Unable to verify code.",
      });
      continueAfterLogin();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel w-full max-w-md p-7 sm:p-9">
      <Link href="/" className="text-sm font-bold text-brand">← Pollpoint</Link>
      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-interactive">Welcome back</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-brand">Sign in</h1>
        <p className="mt-2 text-sm text-muted">Access your polls and account.</p>
      </div>

      <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        <button type="button" onClick={() => { setMode("password"); setError(""); }} className={"rounded-lg py-2 " + (mode === "password" ? "bg-white text-brand shadow-sm" : "text-slate-500")}>Password</button>
        <button type="button" onClick={() => { setMode("otp"); setError(""); }} className={"rounded-lg py-2 " + (mode === "otp" ? "bg-white text-brand shadow-sm" : "text-slate-500")}>Email code</button>
      </div>

      {message && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {mode === "password" ? (
        <form onSubmit={submitPassword} className="mt-6 space-y-4">
          <div>
            <label className="field-label" htmlFor="username">Username</label>
            <input id="username" className="field" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Use the username you registered with.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="field pr-16"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-interactive hover:underline"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm font-semibold text-interactive hover:underline">Forgot password?</Link>
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      ) : (
        <div className="mt-6">
          {!otpRequested ? (
            <form onSubmit={requestOtp} className="space-y-4">
              <div>
                <label className="field-label" htmlFor="otp-email">Email address</label>
                <input id="otp-email" type="email" className="field" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <p className="text-xs leading-5 text-slate-500">Django will email a one-time code. You can request another code after the current one expires.</p>
              <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending code…" : "Send login code"}</button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div>
                <label className="field-label" htmlFor="otp-code">Six-digit code</label>
                <input id="otp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" className="field tracking-[0.3em]" required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} />
                <p className="mt-1 text-xs text-slate-500">Code sent to {email}.</p>
              </div>
              <button className="btn-primary w-full" disabled={busy || otp.length !== 6}>{busy ? "Verifying…" : "Verify and sign in"}</button>
              <button type="button" onClick={() => { setOtpRequested(false); setOtp(""); setMessage(""); }} className="w-full text-sm font-semibold text-interactive">Use a different email</button>
            </form>
          )}
        </div>
      )}

      <p className="mt-7 text-center text-sm text-slate-600">
        Don’t have an account? <Link href="/register" className="font-semibold text-interactive hover:underline">Create one</Link>
      </p>
    </section>
  );
}
