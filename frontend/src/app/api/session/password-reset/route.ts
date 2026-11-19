import { NextRequest, NextResponse } from "next/server";
import { djangoJson } from "@/lib/server/backend";
import { isSameOrigin } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  }

  const payload = await request.json();
  const forwardedFor = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";
  const { response, body } = await djangoJson("/api/auth/reset-password/", {
    method: "POST",
    headers: forwardedFor ? { "X-Forwarded-For": forwardedFor } : {},
    body: JSON.stringify(payload),
  });

  return NextResponse.json(
    body ?? { success: false, message: "The backend returned an unreadable response." },
    { status: response.status },
  );
}
