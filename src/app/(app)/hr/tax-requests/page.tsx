import { requireOrg } from "@/lib/access";
import { TaxRequestsClient } from "@/components/hr/tax-requests-client";

export const dynamic = "force-dynamic";

export default async function TaxRequestsPage() {
  await requireOrg("employees.edit");
  return <TaxRequestsClient />;
}