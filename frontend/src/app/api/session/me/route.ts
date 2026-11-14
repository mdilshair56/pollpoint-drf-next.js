import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { djangoJson } from "@/lib/server/backend";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  clearSessionCookies,
  isCurrentSession,
  refreshAccessToken,
  updateSessionTokens,
} from "@/lib/server/session";

export async function GET() {
  const cookieStore = await cookies();
  let access = cookieStore.get(ACCESS_COOKIE)?.value;
  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  // A missing, expired, or previous-server session requires a fresh login.
  if (!isCurrentSession(sessionId)) {
    const result = NextResponse.json(
      { success: false, message: "Your session ended. Please log in again." },
      { status: 401 },
    );
    clearSessionCookies(result);
    return result;
  }
  let currentRefresh = refresh;
  let refreshed = false;

  if (!access && refresh) {
    const tokens = await refreshAccessToken(refresh);
    if (tokens) {
      access = tokens.access;
      currentRefresh = tokens.refresh ?? refresh;
      refreshed = true;
    }
  }

  if (!access) {
    const result = NextResponse.json({ success: false, message: "Authentication required." }, { status: 401 });
    clearSessionCookies(result);
    return result;
  }

  let profile = await djangoJson("/api/auth/users/me/", {
    headers: { Authorization: "Bearer " + access },
  });

  if (profile.response.status === 401 && refresh && !refreshed) {
    const tokens = await refreshAccessToken(refresh);
    if (tokens) {
      access = tokens.access;
      currentRefresh = tokens.refresh ?? refresh;
      refreshed = true;
      profile = await djangoJson("/api/auth/users/me/", {
        headers: { Authorization: "Bearer " + access },
      });
    }
  }

  if (!profile.response.ok || !profile.body) {
    const result = NextResponse.json(
      profile.body ?? { success: false, message: "Could not load the current user." },
      { status: profile.response.status || 502 },
    );
    if (profile.response.status === 401) clearSessionCookies(result);
    return result;
  }

  const result = NextResponse.json({
    success: true,
    message: "Current user retrieved successfully.",
    data: profile.body,
  });
  if (refreshed) updateSessionTokens(result, access, currentRefresh);
  return result;
}
