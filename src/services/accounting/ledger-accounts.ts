import { db } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Operational accounts required by the payroll / staff-loans / expense-claim /
 * statutory-remittance workflows. Upserted idempotently per organization so the
 * glue that generates journals never fails because an account is missing.
 */
export const LEDGER_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: string;
  subtype?: string;
}> = [
  // Assets
  { code: "1250", name: "Staff Loans Receivable", type: "asset", subtype: "current_asset" },
  // Liabilities
  { code: "2350", name: "NHIA/HMO Payable", type: "liability", subtype: "current_liability" },
  { code: "2450", name: "Employee Reimbursements Payable", type: "liability", subtype: "current_liability" },
  { code: "2700", name: "Payroll Clearing (Bank)", type: "liability", subtype: "current_liability" },
  // Expenses
  { code: "5110", name: "Employer Pension Expense", type: "expense", subtype: "employer_contribution" },
  { code: "5120", name: "Employer NHIA/HMO Expense", type: "expense", subtype: "employer_contribution" },
  { code: "5130", name: "Employer Statutory & Benefits Expense", type: "expense" },
];

/** Ensure the operational accounts exist for an organization. Uses the provided
 *  transaction client when running inside an enclosing transaction.
 */
export async function ensureLedgerAccounts(
  organizationId: string,
  client: Tx = db
): Promise<void> {
  for (const acc of LEDGER_ACCOUNTS) {
    await client.account.upsert({
      where: { organizationId_code: { organizationId, code: acc.code } },
      update: {},
      create: {
        organizationId,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        subtype: acc.subtype ?? null,
        isSystem: false,
      },
    });
  }
}