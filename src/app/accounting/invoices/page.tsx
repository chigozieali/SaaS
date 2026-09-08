import { AppShell } from "@/components/layout/app-shell";
import { requireOrg } from "@/lib/access";
import { InvoicesClient } from "@/components/accounting/invoices-client";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  await requireOrg("accounting.invoices");
  return (
    <AppShell>
      <InvoicesClient />
    </AppShell>
  );
}