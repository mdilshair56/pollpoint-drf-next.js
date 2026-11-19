import { NextRequest, NextResponse } from "next/server";
import { djangoJson } from "@/lib/server/backend";
import { isSameOrigin, setSessionCookies } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  }

  const payload = await request.json();
  const verification = await djangoJson<{
    detail?: string;
    access?: string;
    refresh?: string;
  }>("/api/auth/login/verify-otp/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!verification.response.ok || !verification.body?.access || !verification.body.refresh) {
    return NextResponse.json(
      verification.body ?? { success: false, message: "OTP verification failed." },
      { status: verification.response.status || 502 },
    );
  }

  const profile = await djangoJson("/api/auth/users/me/", {
    headers: { Authorization: `Bearer ${verification.body.access}` },
  });

  if (!profile.response.ok || !profile.body) {
    return NextResponse.json(
      { success: false, message: "OTP was accepted, but the user profile could not be loaded." },
      { status: profile.response.status || 502 },
    );
  }

  const result = NextResponse.json({
    success: true,
    message: verification.body.detail ?? "Login successful.",
    data: { user: profile.body },
  });
  setSessionCookies(result, verification.body.access, verification.body.refresh);
  return result;
}
