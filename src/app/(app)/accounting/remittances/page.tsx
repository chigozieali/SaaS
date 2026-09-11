import { requireOrg } from "@/lib/access";
import { RemittancesClient } from "@/components/accounting/remittances-client";

export const dynamic = "force-dynamic";

export default async function RemittancesPage() {
  await requireOrg("accounting.journal");
  return <RemittancesClient />;
}