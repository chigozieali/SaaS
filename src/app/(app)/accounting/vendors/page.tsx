import { requireOrg } from "@/lib/access";
import { VendorsClient } from "@/components/accounting/vendors-client";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  await requireOrg("accounting.bills");
  return (
      <VendorsClient />
  );
}
