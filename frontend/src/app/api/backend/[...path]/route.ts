import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { djangoUrl } from "@/lib/server/backend";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  clearSessionCookies,
  isCurrentSession,
  isSameOrigin,
  refreshAccessToken,
  updateSessionTokens,
} from "@/lib/server/session";

type RouteContext = { params: Promise<{ path: string[] }> };

// Invitation preview/respond are public on the backend: an invitee who is not signed in must be able
// to open the link and decline. They are forwarded without a bearer token when no session exists.
const PUBLIC_PATHS = new Set(["auth/invitations/preview", "auth/invitations/respond"]);

async function proxy(request: NextRequest, context: RouteContext) {
  if (!["GET", "HEAD"].includes(request.method) && !isSameOrigin(request)) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  }

  const { path } = await context.params;
  const djangoPath = "/api/" + path.map(encodeURIComponent).join("/") + "/" + request.nextUrl.search;
  const cookieStore = await cookies();
  const refresh = cookieStore.get(REFRESH_COOKIE)?.value;
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  let currentRefresh = refresh;
  let access = cookieStore.get(ACCESS_COOKIE)?.value;
  let refreshed = false;

  if (!isCurrentSession(sessionId)) {
    // Invitation preview/respond remain public for recipients who are not logged in.
    if (PUBLIC_PATHS.has(path.join("/"))) {
      const publicBody =
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.text();
      const publicResponse = await fetch(djangoUrl(djangoPath), {
        method: request.method,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(request.headers.get("content-type")
            ? { "Content-Type": request.headers.get("content-type") as string }
            : {}),
        },
        body: publicBody,
      });
      const publicText = await publicResponse.text();

      return new NextResponse(publicText || null, {
        status: publicResponse.status,
        headers: {
          "Content-Type": publicResponse.headers.get("content-type") ?? "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    const result = NextResponse.json(
      { success: false, message: "Your session ended. Please log in again." },
      { status: 401 },
    );
    clearSessionCookies(result);
    return result;
  }

  if (!access && refresh) {
    const tokens = await refreshAccessToken(refresh);
    if (tokens) {
      access = tokens.access;
      currentRefresh = tokens.refresh ?? refresh;
      refreshed = true;
    }
  }

  if (!access && PUBLIC_PATHS.has(path.join("/"))) {
    const publicBody = request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();
    const publicResponse = await fetch(djangoUrl(djangoPath), {
      method: request.method,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(request.headers.get("content-type")
          ? { "Content-Type": request.headers.get("content-type") as string }
          : {}),
      },
      body: publicBody,
    });
    const publicText = await publicResponse.text();
    return new NextResponse(publicText || null, {
      status: publicResponse.status,
      headers: {
        "Content-Type": publicResponse.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  }

  if (!access) {
    const result = NextResponse.json(
      { success: false, message: "Authentication required. Please log in again." },
      { status: 401 },
    );
    clearSessionCookies(result);
    return result;
  }

  const method = request.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();
  const sendToDjango = (token: string) =>
    fetch(djangoUrl(djangoPath), {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
        ...(request.headers.get("content-type")
          ? { "Content-Type": request.headers.get("content-type") as string }
          : {}),
      },
      body,
    });

  let backendResponse = await sendToDjango(access);

  if (backendResponse.status === 401 && refresh && !refreshed) {
    const tokens = await refreshAccessToken(refresh);
    if (tokens) {
      access = tokens.access;
      currentRefresh = tokens.refresh ?? refresh;
      refreshed = true;
      backendResponse = await sendToDjango(access);
    }
  }

  const responseText = await backendResponse.text();
  const result = new NextResponse(responseText || null, {
    status: backendResponse.status,
    headers: {
      "Content-Type": backendResponse.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });

  if (refreshed) updateSessionTokens(result, access, currentRefresh);
  if (backendResponse.status === 401) clearSessionCookies(result);

  return result;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
