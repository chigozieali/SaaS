import { requireOrg } from "@/lib/access";
import { CustomersClient } from "@/components/accounting/customers-client";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const ctx = await requireOrg("accounting.invoices");
  return (
      <CustomersClient permissions={ctx.permissions} />
  );
}
