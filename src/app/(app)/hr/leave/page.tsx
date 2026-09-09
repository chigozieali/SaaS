import { requireOrg } from "@/lib/access";
import { LeaveClient } from "@/components/hr/leave-client";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  await requireOrg("leave.view");
  return (
      <LeaveClient />
  );
}
