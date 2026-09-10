import { requireOrg } from "@/lib/access";
import { LeaveTypesClient } from "@/components/hr/leave-types-client";

export const dynamic = "force-dynamic";

export default async function LeaveTypesPage() {
  const ctx = await requireOrg("leave.view");
  return <LeaveTypesClient canEdit={ctx.permissions.has("leave.create")} />;
}