import { requireOrg } from "@/lib/access";
import { LoansClient } from "@/components/payroll/loans-client";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
  await requireOrg("payroll.view");
  return <LoansClient />;
}