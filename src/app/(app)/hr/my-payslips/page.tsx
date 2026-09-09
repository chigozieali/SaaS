import { requireOrg } from "@/lib/access";
import { MyPayslipsClient } from "@/components/hr/my-payslips-client";

export const dynamic = "force-dynamic";

export default async function MyPayslipsPage() {
  await requireOrg("employees.self");
  return <MyPayslipsClient />;
}