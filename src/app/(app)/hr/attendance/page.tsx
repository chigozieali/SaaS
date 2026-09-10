import { requireOrg } from "@/lib/access";
import { AttendanceClient } from "@/components/hr/attendance-client";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const ctx = await requireOrg("attendance.view");
  return <AttendanceClient canEdit={ctx.permissions.has("attendance.edit")} />;
}
