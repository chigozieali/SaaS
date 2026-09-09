import { requireOrg } from "@/lib/access";
import { ExpensesClient } from "@/components/accounting/expenses-client";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  await requireOrg("accounting.expenses");
  return (
      <ExpensesClient />
  );
}
