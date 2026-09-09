import { requireOrg } from "@/lib/access";
import { PayrollClient } from "@/components/payroll/payroll-client";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  await requireOrg("payroll.view");
  return (
      <PayrollClient />
  );
}
