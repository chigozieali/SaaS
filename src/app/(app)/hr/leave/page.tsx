import { requireOrg } from "@/lib/access";
import { LeaveClient } from "@/components/hr/leave-client";

export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const ctx = await requireOrg("leave.view");
  return <LeaveClient canManage={ctx.permissions.has("employees.view")} />;
}
