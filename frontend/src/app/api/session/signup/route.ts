import { NextRequest, NextResponse } from "next/server";
import { djangoJson } from "@/lib/server/backend";
import { isSameOrigin } from "@/lib/server/session";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  }

  const payload = await request.json();
  const { response, body } = await djangoJson("/api/auth/signup/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return NextResponse.json(
    body ?? { success: false, message: "The backend returned an unreadable response." },
    { status: response.status },
  );
}
