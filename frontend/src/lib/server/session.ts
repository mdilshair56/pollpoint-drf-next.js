import "server-only";

import { NextResponse } from "next/server";
import { djangoJson } from "@/lib/server/backend";
import { getSessionRuntimeId } from "@/lib/server/session-runtime";

export const ACCESS_COOKIE = "auth_access";
export const REFRESH_COOKIE = "auth_refresh";
export const SESSION_COOKIE = "auth_session";

const ACCESS_MAX_AGE = 10 * 60;
const SESSION_MAX_AGE = 24 * 60 * 60;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// Called only after a successful login or OTP verification.
// This is the fixed 24-hour session lifetime and is not renewed by refreshes.
export function setSessionCookies(
  response: NextResponse,
  access: string,
  refresh?: string,
): void {
  response.cookies.set(ACCESS_COOKIE, access, {
    ...cookieOptions,
    maxAge: ACCESS_MAX_AGE,
  });

  if (refresh) {
    response.cookies.set(REFRESH_COOKIE, refresh, {
      ...cookieOptions,
      maxAge: SESSION_MAX_AGE,
    });
  }

  response.cookies.set(SESSION_COOKIE, getSessionRuntimeId(), {
    ...cookieOptions,
    maxAge: SESSION_MAX_AGE,
  });
}

// Refresh access/refresh JWTs without extending the original 24-hour session.
export function updateSessionTokens(
  response: NextResponse,
  access: string,
  refresh?: string,
): void {
  response.cookies.set(ACCESS_COOKIE, access, {
    ...cookieOptions,
    maxAge: ACCESS_MAX_AGE,
  });

  if (refresh) {
    response.cookies.set(REFRESH_COOKIE, refresh, {
      ...cookieOptions,
      maxAge: SESSION_MAX_AGE,
    });
  }
}

export function isCurrentSession(sessionId?: string): boolean {
  return Boolean(sessionId && sessionId === getSessionRuntimeId());
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

export async function refreshAccessToken(
  refresh: string,
): Promise<{ access: string; refresh?: string } | null> {
  const { response, body } = await djangoJson<{
    access?: string;
    refresh?: string;
  }>("/api/auth/token/refresh/", {
    method: "POST",
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok || !body?.access) return null;
  return { access: body.access, refresh: body.refresh };
}

export function isSameOrigin(request: Request): boolean {
  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");

  if (origin) return origin === expectedOrigin;

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  return request.headers.get("sec-fetch-site") === "same-origin";
}
