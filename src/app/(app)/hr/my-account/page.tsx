import { requireOrg } from "@/lib/access";
import { MyAccountClient } from "@/components/hr/my-account-client";

export const dynamic = "force-dynamic";

export default async function MyAccountPage() {
  await requireOrg("employees.self");
  return <MyAccountClient />;
}