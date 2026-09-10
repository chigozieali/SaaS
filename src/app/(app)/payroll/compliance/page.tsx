import { requireOrg } from "@/lib/access";
import { ComplianceClient } from "@/components/payroll/compliance-client";

export const dynamic = "force-dynamic";

export default async function PayrollCompliancePage() {
  await requireOrg("payroll.view");
  return <ComplianceClient />;
}