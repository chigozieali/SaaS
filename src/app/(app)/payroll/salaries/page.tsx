import { requireOrg } from "@/lib/access";
import { SalariesClient } from "@/components/payroll/salaries-client";

export const dynamic = "force-dynamic";

export default async function SalariesPage() {
  const ctx = await requireOrg("payroll.view");
  return (
      <SalariesClient permissions={ctx.permissions} />
  );
}
