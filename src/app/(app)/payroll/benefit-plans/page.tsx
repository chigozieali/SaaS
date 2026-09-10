import { requireOrg } from "@/lib/access";
import { BenefitPlansClient } from "@/components/payroll/benefit-plans-client";

export const dynamic = "force-dynamic";

export default async function BenefitPlansPage() {
  const ctx = await requireOrg("employees.view");
  return <BenefitPlansClient canEdit={ctx.permissions.has("employees.payroll")} />;
}