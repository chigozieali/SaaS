import { AppShell } from "@/components/layout/app-shell";
import { requireOrg } from "@/lib/access";
import { BillsClient } from "@/components/accounting/bills-client";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  await requireOrg("accounting.bills");
  return (
    <AppShell>
      <BillsClient />
    </AppShell>
  );
}