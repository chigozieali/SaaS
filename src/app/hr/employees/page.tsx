import { AppShell } from "@/components/layout/app-shell";
import { requireOrg } from "@/lib/access";
import { EmployeesClient } from "@/components/hr/employees-client";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  await requireOrg("employees.view");
  return (
    <AppShell>
      <EmployeesClient />
    </AppShell>
  );
}