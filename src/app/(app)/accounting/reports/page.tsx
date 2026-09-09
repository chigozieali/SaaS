import { requireOrg } from "@/lib/access";
import { ReportsClient } from "@/components/accounting/reports-client";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireOrg("accounting.reports");
  return (
      <ReportsClient />
  );
}
