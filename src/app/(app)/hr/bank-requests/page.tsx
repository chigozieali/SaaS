import { requireOrg } from "@/lib/access";
import { BankRequestsClient } from "@/components/hr/bank-requests-client";

export const dynamic = "force-dynamic";

export default async function BankRequestsPage() {
  await requireOrg("employees.edit");
  return <BankRequestsClient />;
}