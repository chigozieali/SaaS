import { db } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type JournalLineInput = {
  accountCode: string;
  description?: string;
  debit?: number;
  credit?: number;
};

export async function postJournalEntry(params: {
  organizationId: string;
  date: Date;
  reference?: string;
  description?: string;
  source?: string;
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
        status: "posted",
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

export async function buildPayrollJournal(params: {
  organizationId: string;
  periodId: string;
  entryDate: Date;
  reference: string;
  totalGross: number | Prisma.Decimal;
  totalDeductions: number | Prisma.Decimal;
  totalNet: number | Prisma.Decimal;
}): Promise<JournalLineInput[]> {
  const { totalGross, totalDeductions, totalNet } = params;
  const gross = Number(totalGross);
  const deductions = Number(totalDeductions);
  const net = Number(totalNet);

  // Mirrors the seeded chart of accounts
  const lines: JournalLineInput[] = [
    // Dr. Salary expense  |  Cr. Accrued salaries + deduction liabilities + Bank/Net
    { accountCode: "5100", description: "Gross salaries", debit: gross },
    { accountCode: "2100", description: "Accrued salaries (net)", credit: net },
    { accountCode: "2200", description: "PAYE tax payable", credit: deductions * 0.6 },
    { accountCode: "2300", description: "Pension payable", credit: deductions * 0.4 },
  ];

  return lines;
}

export async function postPayrollToAccounting(params: {
  organizationId: string;
  runId: string;
  userId: string;
}): Promise<string> {
  return db.$transaction(async (tx) => {
    const run = await tx.payrollRun.findFirst({
      where: { id: params.runId, organizationId: params.organizationId },
    });
    if (!run) throw new Error("Payroll run not found");
    if (run.status !== "finalized") throw new Error("Only finalized runs can be posted");
    if (run.journalEntryId) throw new Error("Payroll already posted to accounting");

    const period = await tx.payrollPeriod.findUnique({ where: { id: run.periodId } });
    if (!period) throw new Error("Payroll period not found");

    const lines = await buildPayrollJournal({
      organizationId: params.organizationId,
      periodId: run.periodId,
      entryDate: period.payDate ?? period.endDate,
      reference: `Payroll ${period.name}`,
      totalGross: run.totalGross,
      totalDeductions: run.totalDeductions,
      totalNet: run.totalNet,
    });

    // Inline posting logic to get entry id and stay in the same transaction
    const codes = lines.map((l) => l.accountCode);
    const accounts = await tx.account.findMany({
      where: { organizationId: params.organizationId, code: { in: codes } },
    });
    const accountMap = new Map(accounts.map((a) => [a.code, a.id]));
    for (const l of lines) {
      if (!accountMap.has(l.accountCode)) throw new Error(`Account ${l.accountCode} not found`);
    }

    const accountingPeriod = await tx.accountingPeriod.findFirst({
      where: {
        organizationId: params.organizationId,
        startDate: { lte: period.payDate ?? period.endDate },
        endDate: { gte: period.payDate ?? period.endDate },
      },
      orderBy: { startDate: "desc" },
    });

    const entryNumber = `PR-${period.name.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 12)}-${Date.now().toString().slice(-6)}`;

    const entry = await tx.journalEntry.create({
      data: {
        organizationId: params.organizationId,
        periodId: accountingPeriod?.id ?? null,
        entryNumber,
        date: period.payDate ?? period.endDate,
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
      data: { journalEntryId: entry.id, status: "posted" },
    });

    return entry.id;
  }, { timeout: 120_000 });
}