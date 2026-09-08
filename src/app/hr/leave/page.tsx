import { AppShell } from "@/components/layout/app-shell";
import { requireOrg } from "@/lib/access";
import { LeaveClient } from "@/components/hr/leave-client";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  await requireOrg("leave.view");
  return (
    <AppShell>
      <LeaveClient />
    </AppShell>
  );
}