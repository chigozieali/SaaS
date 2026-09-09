import { requireOrg } from "@/lib/access";
import { MyLeaveClient } from "@/components/hr/my-leave-client";

export const dynamic = "force-dynamic";

export default async function MyLeavePage() {
  await requireOrg("employees.self");
  return <MyLeaveClient />;
}