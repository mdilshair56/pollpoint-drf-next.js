import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { djangoJson } from "@/lib/server/backend";
import {
  REFRESH_COOKIE,
  clearSessionCookies,
  isSameOrigin,
  refreshAccessToken,
} from "@/lib/server/session";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  }

  const cookieStore = await cookies();
  const storedRefresh = cookieStore.get(REFRESH_COOKIE)?.value;
  let backendLoggedOut = false;

  if (storedRefresh) {
    // Refresh first so logout is sent with an unexpired access token and
    // the newest refresh token when rotation is enabled in Django.
    const tokens = await refreshAccessToken(storedRefresh);
    if (tokens) {
      const currentRefresh = tokens.refresh ?? storedRefresh;
      const { response } = await djangoJson("/api/auth/logout/", {
        method: "POST",
        headers: { Authorization: "Bearer " + tokens.access },
        body: JSON.stringify({ refresh: currentRefresh }),
      });
      backendLoggedOut = response.ok;
    }
  }

  const result = NextResponse.json({
    success: true,
    message: backendLoggedOut
      ? "Logged out and refresh token invalidated."
      : "Local session cleared. The backend token could not be invalidated.",
    data: null,
  });
  clearSessionCookies(result);
  return result;
}
