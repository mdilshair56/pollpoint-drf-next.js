import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  clearSessionCookies,
  isSameOrigin,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  isCurrentSession,
  refreshAccessToken,
  updateSessionTokens,
} from "@/lib/server/session";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  }

  const cookieStore = await cookies();
  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!isCurrentSession(sessionId)) {
    const result = NextResponse.json(
      { success: false, message: "Your session ended. Please log in again." },
      { status: 401 },
    );
    clearSessionCookies(result);
    return result;
  }

  if (!refresh) {
    const result = NextResponse.json(
      { success: false, message: "Your session has expired. Please log in again." },
      { status: 401 },
    );
    clearSessionCookies(result);
    return result;
  }

  const tokens = await refreshAccessToken(refresh);
  if (!tokens) {
    const result = NextResponse.json(
      { success: false, message: "Your session has expired. Please log in again." },
      { status: 401 },
    );
    clearSessionCookies(result);
    return result;
  }

  const result = NextResponse.json({ success: true, message: "Session refreshed.", data: null });
  updateSessionTokens(result, tokens.access, tokens.refresh ?? refresh);
  return result;
}
