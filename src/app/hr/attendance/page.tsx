import { AppShell } from "@/components/layout/app-shell";
import { requireOrg } from "@/lib/access";
import { AttendanceClient } from "@/components/hr/attendance-client";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  await requireOrg("attendance.view");
  return (
    <AppShell>
      <AttendanceClient />
    </AppShell>
  );
}