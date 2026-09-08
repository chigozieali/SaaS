import { AppShell } from "@/components/layout/app-shell";
import { requireOrg } from "@/lib/access";
import { ConfigurationClient } from "@/components/payroll/configuration-client";

export const dynamic = "force-dynamic";

export default async function ConfigurationPage() {
  await requireOrg("payroll.configure");
  return (
    <AppShell>
      <ConfigurationClient />
    </AppShell>
  );
}