import { AppShell } from "@/components/layout/app-shell";
import { requireOrg } from "@/lib/access";
import { SalariesClient } from "@/components/payroll/salaries-client";

export const dynamic = "force-dynamic";

export default async function SalariesPage() {
  await requireOrg("payroll.view");
  return (
    <AppShell>
      <SalariesClient />
    </AppShell>
  );
}