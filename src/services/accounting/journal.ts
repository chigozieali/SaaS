import { db } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ensureLedgerAccounts } from "@/services/accounting/ledger-accounts";

export type JournalLineInput = {
  accountCode: string;
  description?: string;
  debit?: number;
  credit?: number;
};

function num(v: unknown): number {
  return Math.round(Number(v ?? 0) * 100) / 100;
}

type Tx = Prisma.TransactionClient;

export async function postJournalEntry(params: {
  organizationId: string;
  date: Date;
  reference?: string;
  description?: string;
  source?: string;
  status?: string;
  createdById?: string;
  lines: JournalLineInput[];
}) {
  return db.$transaction(async (tx) => {
    const { organizationId, lines } = params;
    if (!lines.length) throw new Error("Journal entry requires at least one line");

    // Resolve account codes -> ids within this organization
    const codes = lines.map((l) => l.accountCode);
    const accounts = await tx.account.findMany({
      where: { organizationId, code: { in: codes } },
    });
    const accountMap = new Map(accounts.map((a) => [a.code, a.id]));
    for (const l of lines) {
      if (!accountMap.has(l.accountCode)) {
        throw new Error(`Account ${l.accountCode} not found`);
      }
    }

    // Double-entry balance check
    const debits = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
    const credits = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
    if (Math.abs(debits - credits) > 0.01) {
      throw new Error("Journal is out of balance: debits must equal credits");
    }

    // Period resolution (open period containing the date)
    const period = await tx.accountingPeriod.findFirst({
      where: {
        organizationId,
        startDate: { lte: params.date },
        endDate: { gte: params.date },
      },
      orderBy: { startDate: "desc" },
    });

    if (period?.isClosed) {
      throw new Error(`Accounting period "${period.name}" is locked`);
    }

    const entryNumber = `JE-${Date.now().toString().slice(-8)}`;

    const entry = await tx.journalEntry.create({
      data: {
        organizationId,
        periodId: period?.id ?? null,
        entryNumber,
        date: params.date,
        reference: params.reference,
        description: params.description,
        status: params.status ?? "posted",
        source: params.source ?? "manual",
        createdById: params.createdById,
        lines: {
          create: lines.map((l) => ({
            accountId: accountMap.get(l.accountCode)!,
            description: l.description,
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });

    return entry;
  }, { timeout: 120_000 });
}

// =====================================================================
// PAYROLL JOURNALS
// =====================================================================

/**
 * Map a named payroll deduction to its GL account. Sign matters: most
 * deductions are liabilities (credited) but negative top-ups (e.g. expense
 * reimbursements paid via payroll) flip into a debit against the payable.
 */
export function classifyEmployeeDeduction(name: string): { code: string; label: string } {
  const n = name.toLowerCase();
  if (/(income\s*tax|paye)/.test(n)) return { code: "2200", label: "PAYE tax payable" };
  if (n.includes("pension")) return { code: "2300", label: "Pension payable" };
  if (/(nhia|hmo|health)/.test(n)) return { code: "2350", label: "NHIA/HMO payable" };
  if (/(loan|advance)/.test(n)) return { code: "1250", label: "Staff loans receivable" };
  if (/(expense|reimburse|claim)/.test(n)) return { code: "2450", label: "Employee reimbursements payable" };
  return { code: "2400", label: "Other statutory deductions payable" };
}

export function classifyEmployerContribution(name: string): {
  code: string;
  label: string;
  payable: string;
} {
  const n = name.toLowerCase();
  if (n.includes("pension")) return { code: "5110", label: "Employer pension expense", payable: "2300" };
  if (/(nhia|hmo|health)/.test(n)) return { code: "5120", label: "Employer NHIA/HMO expense", payable: "2350" };
  return { code: "5130", label: "Employer statutory & benefits expense", payable: "2400" };
}

type RunLineLike = {
  grossPay: number | Prisma.Decimal;
  netPay: number | Prisma.Decimal;
  deductions: Prisma.JsonValue;
  employerContribJson: Prisma.JsonValue;
};

/**
 * Build a balanced payroll journal from the per-employee line breakdown:
 *
 *   Dr  Salaries & Wages Expense      (gross)
 *   Dr  Employer Pension Expense      (employer pension share)
 *   Dr  Employer NHIA/HMO Expense     (employer NHIA/HMO share)
 *   Cr  Payroll Clearing              (net paid out)
 *   Cr  PAYE Payable                  (income tax withheld)
 *   Cr  Employee Pension Payable      (employee pension share)
 *   Cr  NHIA/HMO Payable              (employee + NHIA share)
 *   Cr  Staff Loans Receivable        (loan repayment recovered from pay)
 *   Cr  Employee Reimbursements Payable (expense claim top-ups, reversed sign)
 */
export function buildPayrollJournalFromLines(lines: RunLineLike[]): JournalLineInput[] {
  const totalGross = lines.reduce((s, l) => s + num(l.grossPay), 0);
  const totalNet = lines.reduce((s, l) => s + num(l.netPay), 0);

  const out: JournalLineInput[] = [];
  out.push({ accountCode: "5100", description: "Gross salaries & wages", debit: totalGross });
  out.push({ accountCode: "2700", description: "Net pay to clearing", credit: totalNet });

  // Employee-side deductions (tax, pension, NHIA, loans, reimbursements, unpaid leave…)
  const employeeCredits = new Map<string, { label: string; amount: number }>();
  for (const line of lines) {
    const deductions = (line.deductions ?? {}) as Record<string, number>;
    for (const [name, rawAmount] of Object.entries(deductions)) {
      const amount = Math.round(num(rawAmount) * 100) / 100;
      if (!amount) continue;
      const cls = classifyEmployeeDeduction(name);
      const bucket = employeeCredits.get(cls.code) ?? { label: cls.label, amount: 0 };
      bucket.amount += amount;
      employeeCredits.set(cls.code, bucket);
    }
  }
  for (const [code, bucket] of employeeCredits) {
    out.push({ accountCode: code, description: bucket.label, credit: bucket.amount });
  }

  // Employer contributions: expense + offsetting payable on the credit side.
  for (const line of lines) {
    const employer = (line.employerContribJson ?? {}) as Record<string, number>;
    for (const [name, rawAmount] of Object.entries(employer)) {
      const amount = Math.round(num(rawAmount) * 100) / 100;
      if (!amount) continue;
      const cls = classifyEmployerContribution(name);
      out.push({ accountCode: cls.code, description: cls.label, debit: amount });
      out.push({ accountCode: cls.payable, description: `${cls.label} (payable)`, credit: amount });
    }
  }

  return out;
}

export async function postPayrollToAccounting(params: {
  organizationId: string;
  runId: string;
  userId: string;
}): Promise<string> {
  return db.$transaction(async (tx) => {
    const run = await tx.payrollRun.findFirst({
      where: { id: params.runId, organizationId: params.organizationId },
      include: { lines: true },
    });
    if (!run) throw new Error("Payroll run not found");
    if (!["approved", "finalized"].includes(run.status)) {
      throw new Error("Payroll must be approved before posting to accounting");
    }
    if (run.journalEntryId) {
      return run.journalEntryId;
    }

    const period = await tx.payrollPeriod.findUnique({ where: { id: run.periodId } });
    if (!period) throw new Error("Payroll period not found");

    await ensureLedgerAccounts(params.organizationId, tx);

    const lines = buildPayrollJournalFromLines(run.lines);

    if (!lines.length) throw new Error("Payroll run has no calculated lines");

    const codes = lines.map((l) => l.accountCode);
    const accounts = await tx.account.findMany({
      where: { organizationId: params.organizationId, code: { in: codes } },
    });
    const accountMap = new Map(accounts.map((a) => [a.code, a.id]));
    for (const l of lines) {
      if (!accountMap.has(l.accountCode)) throw new Error(`Account ${l.accountCode} not found`);
    }

    const entryDate = period.payDate ?? period.endDate;
    const accountingPeriod = await tx.accountingPeriod.findFirst({
      where: {
        organizationId: params.organizationId,
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
      orderBy: { startDate: "desc" },
    });
    if (accountingPeriod?.isClosed) {
      throw new Error(`Accounting period "${accountingPeriod.name}" is locked`);
    }

    const entryNumber = `PR-${period.name.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 12)}-${Date.now().toString().slice(-6)}`;

    const entry = await tx.journalEntry.create({
      data: {
        organizationId: params.organizationId,
        periodId: accountingPeriod?.id ?? null,
        entryNumber,
        date: entryDate,
        reference: `Payroll ${period.name}`,
        description: `Payroll run for ${period.name}`,
        status: "posted",
        source: "payroll",
        createdById: params.userId,
        lines: {
          create: lines.map((l) => ({
            accountId: accountMap.get(l.accountCode)!,
            description: l.description,
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
          })),
        },
      },
    });

    await tx.payrollRun.update({
      where: { id: run.id },
      data: { journalEntryId: entry.id },
    });

    await processLoanRepayments(tx, run, period.name, params.organizationId);
    await settlePayrollExpenseReimbursements(tx, run.id, params.organizationId, params.userId);

    return entry.id;
  }, { timeout: 120_000 });
}

/**
 * Deduct "Loan / Advance" portions recovered from each employee's pay against
 * their active staff-loan balances and record repayment history.
 */
async function processLoanRepayments(
  tx: Tx,
  run: { id: string; lines: RunLineLike[] },
  periodName: string,
  organizationId: string
): Promise<void> {
  const buckets = new Map<string, number>();
  for (const line of run.lines) {
    const deductions = (line.deductions ?? {}) as Record<string, number>;
    for (const [name, rawAmount] of Object.entries(deductions)) {
      if (!/(loan|advance)/.test(name.toLowerCase())) continue;
      const amount = num(rawAmount);
      if (amount <= 0) continue;
      const employeeId = (line as { employeeId?: string }).employeeId;
      if (!employeeId) continue;
      buckets.set(employeeId, (buckets.get(employeeId) ?? 0) + amount);
    }
  }

  for (const [employeeId, total] of buckets) {
    if (Math.round(total * 100) <= 0) continue;
    let shortfall = total;
    const loans = await tx.staffLoan.findMany({
      where: { employeeId, status: "active", outstandingBalance: { gt: 0 } },
      orderBy: { createdAt: "asc" },
    });
    for (const loan of loans) {
      if (shortfall <= 0) break;
      const repayment = Math.min(shortfall, num(loan.outstandingBalance));
      if (repayment <= 0) continue;
      await tx.staffLoan.update({
        where: { id: loan.id },
        data: { outstandingBalance: Number((num(loan.outstandingBalance) - repayment).toFixed(2)) },
      });
      await tx.staffLoanRepayment.create({
        data: {
          loanId: loan.id,
          organizationId,
          payrollRunId: run.id,
          source: "payroll",
          amount: repayment,
          reference: `Payroll ${periodName}`,
          paidAt: new Date(),
        },
      });
      shortfall = Math.round((shortfall - repayment) * 100) / 100;
    }
  }
}

/**
 * Expense claims attached to this payroll run are paid out through net pay;
 * their payable was cleared by the negative reimbursements credit in the
 * journal. Mark them as paid.
 */
async function settlePayrollExpenseReimbursements(
  tx: Tx,
  runId: string,
  organizationId: string,
  userId: string
): Promise<void> {
  await tx.expense.updateMany({
    where: { organizationId, payrollRunId: runId, paidAt: null },
    data: { paidAt: new Date(), paidById: userId },
  });
}

// =====================================================================
// EXPENSE CLAIMS
// =====================================================================

export async function bookExpenseApproval(params: {
  organizationId: string;
  expenseId: string;
  userId: string;
}): Promise<string> {
  return db.$transaction(async (tx) => {
    const expense = await tx.expense.findFirst({
      where: { id: params.expenseId, organizationId: params.organizationId },
    });
    if (!expense) throw new Error("Expense not found");
    if (!["pending", "approved"].includes(expense.status)) {
      throw new Error(`Cannot book expense in status "${expense.status}"`);
    }
    if (expense.journalEntryId) return expense.journalEntryId;

    await ensureLedgerAccounts(params.organizationId, tx);

    const category = expense.categoryId
      ? await tx.expenseCategory.findUnique({ where: { id: expense.categoryId } })
      : null;
    const expenseAccount = category?.accountId
      ? await tx.account.findFirst({
          where: { id: category.accountId, organizationId: params.organizationId },
        })
      : null;
    const debitAccount =
      expenseAccount ??
      (await tx.account.findFirst({
        where: { organizationId: params.organizationId, type: "expense" },
        orderBy: { code: "asc" },
      }));
    if (!debitAccount) throw new Error("Required expense GL account is not set up");

    const payableCode = expense.employeeId ? "2450" : "2000";
    const payableAccount = await tx.account.findFirst({
      where: { organizationId: params.organizationId, code: payableCode },
    });
    if (!payableAccount) throw new Error("Required payable GL account is not set up");

    const entryNumber = `EXP-${Date.now().toString().slice(-8)}`;

    const entry = await tx.journalEntry.create({
      data: {
        organizationId: params.organizationId,
        date: expense.date,
        entryNumber,
        reference: `Expense ${expense.id.slice(0, 8)}`,
        description: expense.description ?? "Expense reimbursement",
        status: "posted",
        source: "expense",
        createdById: params.userId,
        lines: {
          create: [
            { accountId: debitAccount.id, description: expense.description ?? "Expense reimbursement", debit: num(expense.amount) },
            { accountId: payableAccount.id, description: "Expense payable", credit: num(expense.amount) },
          ],
        },
      },
    });

    await tx.expense.update({
      where: { id: expense.id },
      data: { journalEntryId: entry.id },
    });

    return entry.id;
  }, { timeout: 120_000 });
}

export async function payExpenseViaBank(params: {
  organizationId: string;
  expenseId: string;
  userId: string;
  date?: Date;
  reference?: string;
}): Promise<string> {
  return db.$transaction(async (tx) => {
    const expense = await tx.expense.findFirst({
      where: { id: params.expenseId, organizationId: params.organizationId },
    });
    if (!expense) throw new Error("Expense not found");
    if (expense.status !== "approved") throw new Error("Only approved expenses can be paid");
    if (expense.paidAt) throw new Error("Expense is already paid");

    await ensureLedgerAccounts(params.organizationId, tx);

    const payableCode = expense.employeeId ? "2450" : "2000";
    const payableAccount = await tx.account.findFirst({
      where: { organizationId: params.organizationId, code: payableCode },
    });
    const clearingAccount = await tx.account.findFirst({
      where: { organizationId: params.organizationId, code: "2700" },
    });
    if (!payableAccount || !clearingAccount) {
      throw new Error("Required payable/clearing GL accounts are not set up");
    }

    const entryDate = params.date ?? expense.date;
    const accountingPeriod = await tx.accountingPeriod.findFirst({
      where: {
        organizationId: params.organizationId,
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
      orderBy: { startDate: "desc" },
    });
    if (accountingPeriod?.isClosed) {
      throw new Error(`Accounting period "${accountingPeriod.name}" is locked`);
    }

    const entryNumber = `EMP-${Date.now().toString().slice(-8)}`;

    const entry = await tx.journalEntry.create({
      data: {
        organizationId: params.organizationId,
        periodId: accountingPeriod?.id ?? null,
        date: entryDate,
        entryNumber,
        reference: `Expense payment ${expense.id.slice(0, 8)}`,
        description: `Payment of ${expense.description ?? "expense"}`,
        status: "posted",
        source: "expense_payment",
        createdById: params.userId,
        lines: {
          create: [
            { accountId: payableAccount.id, description: "Settle expense payable", debit: num(expense.amount) },
            { accountId: clearingAccount.id, description: "Cash/bank disbursement", credit: num(expense.amount) },
          ],
        },
      },
    });

    await tx.expense.update({
      where: { id: expense.id },
      data: {
        status: "paid",
        paidAt: new Date(),
        paidById: params.userId,
        reimbursementMethod: "bank",
        bankRef: params.reference ?? null,
      },
    });

    return entry.id;
  }, { timeout: 120_000 });
}

// =====================================================================
// STAFF LOANS
// =====================================================================

export async function disburseStaffLoan(params: {
  organizationId: string;
  loanId: string;
  userId: string;
  date?: Date;
}): Promise<string> {
  return db.$transaction(async (tx) => {
    const loan = await tx.staffLoan.findFirst({
      where: { id: params.loanId, organizationId: params.organizationId },
    });
    if (!loan) throw new Error("Loan not found");
    if (loan.status !== "approved") throw new Error("Loan must be approved before disbursement");
    if (loan.journalEntryId) return loan.journalEntryId;

    await ensureLedgerAccounts(params.organizationId, tx);

    const receivableAccount = await tx.account.findFirst({
      where: { organizationId: params.organizationId, code: "1250" },
    });
    const clearingAccount = await tx.account.findFirst({
      where: { organizationId: params.organizationId, code: "2700" },
    });
    if (!receivableAccount || !clearingAccount) {
      throw new Error("Required loan GL accounts are not set up");
    }

    const entryDate = params.date ?? new Date();
    const accountingPeriod = await tx.accountingPeriod.findFirst({
      where: {
        organizationId: params.organizationId,
        startDate: { lte: entryDate },
        endDate: { gte: entryDate },
      },
      orderBy: { startDate: "desc" },
    });
    if (accountingPeriod?.isClosed) {
      throw new Error(`Accounting period "${accountingPeriod.name}" is locked`);
    }

    const entryNumber = `LN-${Date.now().toString().slice(-8)}`;

    const entry = await tx.journalEntry.create({
      data: {
        organizationId: params.organizationId,
        periodId: accountingPeriod?.id ?? null,
        date: entryDate,
        entryNumber,
        reference: `Staff loan ${loan.id.slice(0, 8)}`,
        description: loan.purpose ?? "Staff loan disbursement",
        status: "posted",
        source: "loan",
        createdById: params.userId,
        lines: {
          create: [
            { accountId: receivableAccount.id, description: "Staff loan granted", debit: num(loan.amount) },
            { accountId: clearingAccount.id, description: "Cash/bank disbursement", credit: num(loan.amount) },
          ],
        },
      },
    });

    await tx.staffLoan.update({
      where: { id: loan.id },
      data: {
        status: "active",
        outstandingBalance: Number(num(loan.amount).toFixed(2)),
        disbursedById: params.userId,
        disbursedAt: new Date(),
        journalEntryId: entry.id,
      },
    });

    return entry.id;
  }, { timeout: 120_000 });
}

// =====================================================================
// STATUTORY REMITTANCES
// =====================================================================

export async function postRemittance(params: {
  organizationId: string;
  code: string;
  amount: number;
  date: Date;
  reference?: string;
  userId: string;
}): Promise<string> {
  return db.$transaction(async (tx) => {
    await ensureLedgerAccounts(params.organizationId, tx);

    const account = await tx.account.findFirst({
      where: { organizationId: params.organizationId, code: params.code },
    });
    if (!account) throw new Error(`Account ${params.code} not found`);
    if (account.type !== "liability") throw new Error("Only liability accounts can be remitted");

    const clearingAccount = await tx.account.findFirst({
      where: { organizationId: params.organizationId, code: "2700" },
    });
    if (!clearingAccount) throw new Error("Required clearing GL account is not set up");

    const accountingPeriod = await tx.accountingPeriod.findFirst({
      where: {
        organizationId: params.organizationId,
        startDate: { lte: params.date },
        endDate: { gte: params.date },
      },
      orderBy: { startDate: "desc" },
    });
    if (accountingPeriod?.isClosed) {
      throw new Error(`Accounting period "${accountingPeriod.name}" is locked`);
    }

    const amount = Math.round(params.amount * 100) / 100;
    if (amount <= 0) throw new Error("Remittance amount must be positive");

    const entryNumber = `REM-${Date.now().toString().slice(-8)}`;

    const entry = await tx.journalEntry.create({
      data: {
        organizationId: params.organizationId,
        periodId: accountingPeriod?.id ?? null,
        date: params.date,
        entryNumber,
        reference: params.reference ?? `Remittance ${account.name}`,
        description: `Remittance of ${account.name}`,
        status: "posted",
        source: "remittance",
        createdById: params.userId,
        lines: {
          create: [
            { accountId: account.id, description: `Settle ${account.name}`, debit: amount },
            { accountId: clearingAccount.id, description: "Cash/bank payment", credit: amount },
          ],
        },
      },
    });

    return entry.id;
  }, { timeout: 120_000 });
}