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

// Public paths on the backend: requests forward without a bearer token when no session exists.
const PUBLIC_PATHS = new Set([
  "auth/invitations/preview",
  "auth/invitations/respond",
  "auth/reset-password",
]);

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
  const forwardedFor = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";

  if (!isCurrentSession(sessionId)) {
    // Public paths remain accessible for recipients who are not logged in.
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
          ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
        },
        body: publicBody,
      });
      const publicBuffer = await publicResponse.arrayBuffer();

      return new NextResponse(publicBuffer, {
        status: publicResponse.status,
        headers: {
          "Content-Type": publicResponse.headers.get("content-type") ?? "application/json",
          "Cache-Control": "no-store",
          ...(publicResponse.headers.get("content-disposition")
            ? { "Content-Disposition": publicResponse.headers.get("content-disposition")! }
            : {}),
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
        ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
      },
      body: publicBody,
    });
    const publicBuffer = await publicResponse.arrayBuffer();
    return new NextResponse(publicBuffer, {
      status: publicResponse.status,
      headers: {
        "Content-Type": publicResponse.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
        ...(publicResponse.headers.get("content-disposition")
          ? { "Content-Disposition": publicResponse.headers.get("content-disposition")! }
          : {}),
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
        Accept: "*/*",
        Authorization: "Bearer " + token,
        ...(request.headers.get("content-type")
          ? { "Content-Type": request.headers.get("content-type") as string }
          : {}),
        ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
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

  const responseBuffer = await backendResponse.arrayBuffer();
  const result = new NextResponse(responseBuffer, {
    status: backendResponse.status,
    headers: {
      "Content-Type": backendResponse.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
      ...(backendResponse.headers.get("content-disposition")
        ? { "Content-Disposition": backendResponse.headers.get("content-disposition")! }
        : {}),
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
