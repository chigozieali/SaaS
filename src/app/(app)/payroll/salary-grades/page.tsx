import { requireOrg } from "@/lib/access";
import { SalaryGradesClient } from "@/components/payroll/salary-grades-client";

export const dynamic = "force-dynamic";

export default async function SalaryGradesPage() {
  const ctx = await requireOrg("employees.view");
  return <SalaryGradesClient canEdit={ctx.permissions.has("employees.payroll")} />;
}