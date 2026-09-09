import { requireOrg } from "@/lib/access";
import { MyAttendanceClient } from "@/components/hr/my-attendance-client";

export const dynamic = "force-dynamic";

export default async function MyAttendancePage() {
  await requireOrg("employees.self");
  return <MyAttendanceClient />;
}