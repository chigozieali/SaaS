import { requireOrg } from "@/lib/access";
import { BillsClient } from "@/components/accounting/bills-client";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const ctx = await requireOrg("accounting.bills");
  return (
      <BillsClient permissions={ctx.permissions} />
  );
}
