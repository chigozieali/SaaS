import { AppShell } from "@/components/layout/app-shell";
import { requireOrg } from "@/lib/access";
import { SalariesClient } from "@/components/payroll/salaries-client";

export const dynamic = "force-dynamic";

export default async function SalariesPage() {
  const ctx = await requireOrg("payroll.view");
  return (
    <AppShell>
      <SalariesClient permissions={ctx.permissions} />
    </AppShell>
  );
}