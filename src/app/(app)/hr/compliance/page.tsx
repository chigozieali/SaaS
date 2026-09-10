import { requireOrg } from "@/lib/access";
import { HrComplianceClient } from "@/components/hr/hr-compliance-client";

export const dynamic = "force-dynamic";

export default async function HrCompliancePage() {
  await requireOrg("employees.view");
  return <HrComplianceClient />;
}