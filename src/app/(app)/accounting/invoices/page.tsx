import { requireOrg } from "@/lib/access";
import { InvoicesClient } from "@/components/accounting/invoices-client";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const ctx = await requireOrg("accounting.invoices");
  return (
      <InvoicesClient permissions={ctx.permissions} />
  );
}
