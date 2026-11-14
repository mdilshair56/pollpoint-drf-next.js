import { Suspense } from "react";
import { InvitationResponse } from "@/components/auth/invitation-response";

export default function InvitationResponsePage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading invitation…</div>}>
      <InvitationResponse />
    </Suspense>
  );
}
