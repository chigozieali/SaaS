import { requireOrg } from "@/lib/access";
import { ChartOfAccountsClient } from "@/components/accounting/chart-of-accounts-client";

export const dynamic = "force-dynamic";

export default async function ChartOfAccountsPage() {
  await requireOrg("accounting.chartOfAccounts");
  return (
      <ChartOfAccountsClient />
  );
}
