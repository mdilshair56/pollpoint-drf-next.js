import { NextRequest, NextResponse } from "next/server";
import { djangoJson } from "@/lib/server/backend";
import { isSameOrigin, setSessionCookies } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  }

  const payload = await request.json();
  const { response, body } = await djangoJson<{
    success?: boolean;
    message?: string;
    data?: { access?: string; refresh?: string; user?: unknown };
  }>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok || !body?.data?.access || !body.data.refresh || !body.data.user) {
    return NextResponse.json(body ?? { success: false, message: "Login failed." }, { status: response.status || 502 });
  }

  const result = NextResponse.json({
    success: true,
    message: body.message ?? "Login successful.",
    data: { user: body.data.user },
  });
  setSessionCookies(result, body.data.access, body.data.refresh);
  return result;
}
