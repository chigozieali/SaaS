import { requireOrg } from "@/lib/access";
import { MyRecordsClient } from "@/components/hr/my-records-client";

export const dynamic = "force-dynamic";

export default async function MyRecordsPage() {
  await requireOrg("employees.self");
  return <MyRecordsClient />;
}