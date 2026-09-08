import { db } from "@/lib/prisma";

type DecimalLike = { toNumber(): number } | number | string;

function num(v: DecimalLike | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  return v.toNumber();
}

export type ReportRow = {
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  balance: number;
};

async function aggregateAccounts(organizationId: string, start?: Date, end?: Date) {
  const accounts = await db.account.findMany({
    where: { organizationId, isActive: true },
    orderBy: { code: "asc" },
  });

  const dateFilter =
    start || end
      ? {
          journalEntry: {
            is: {
              organizationId,
              status: "posted",
              date: {
                ...(start ? { gte: start } : {}),
                ...(end ? { lte: end } : {}),
              },
            },
          },
        }
      : { journalEntry: { is: { organizationId, status: "posted" } } };

  const lines = await db.journalEntryLine.findMany({
    where: { ...dateFilter } as never,
    include: { journalEntry: true },
  });

  const balances = new Map<string, number>();
  for (const account of accounts) {
    balances.set(account.id, 0);
  }

  for (const line of lines) {
    const bal = balances.get(line.accountId) ?? 0;
    balances.set(line.accountId, bal + num(line.debit) - num(line.credit));
  }

  return accounts.map((a) => {
    const raw = balances.get(a.id) ?? 0;
    // Normalize: asset/expense -> debit positive; liability/equity/revenue -> credit positive
    let balance = raw;
    if (["liability", "equity", "revenue"].includes(a.type)) {
      balance = -raw;
    }
    return {
      code: a.code,
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      balance: Math.round(balance * 100) / 100,
    } satisfies ReportRow;
  });
}

export async function getProfitAndLoss(organizationId: string, start?: Date, end?: Date) {
  const rows = await aggregateAccounts(organizationId, start, end);

  const revenue = rows
    .filter((r) => r.type === "revenue")
    .reduce((s, r) => s + r.balance, 0);
  const expenses = rows
    .filter((r) => r.type === "expense")
    .reduce((s, r) => s + r.balance, 0);

  return {
    revenue,
    expenses,
    netIncome: Math.round((revenue - expenses) * 100) / 100,
    revenueAccounts: rows.filter((r) => r.type === "revenue"),
    expenseAccounts: rows.filter((r) => r.type === "expense"),
  };
}

export async function getBalanceSheet(organizationId: string, asOf?: Date) {
  const rows = await aggregateAccounts(organizationId, undefined, asOf);

  const totalAssets = rows
    .filter((r) => r.type === "asset")
    .reduce((s, r) => s + r.balance, 0);
  const totalLiabilities = rows
    .filter((r) => r.type === "liability")
    .reduce((s, r) => s + r.balance, 0);
  const equity = rows
    .filter((r) => r.type === "equity")
    .reduce((s, r) => s + r.balance, 0);

  return {
    totalAssets,
    totalLiabilities,
    totalEquity: equity,
    assetAccounts: rows.filter((r) => r.type === "asset"),
    liabilityAccounts: rows.filter((r) => r.type === "liability"),
    equityAccounts: rows.filter((r) => r.type === "equity"),
  };
}

export async function getTrialBalance(organizationId: string) {
  const entries = await db.journalEntry.findMany({
    where: { organizationId, status: "posted" },
    include: { lines: true },
  });

  const summary = new Map<string, { debit: number; credit: number }>();
  for (const entry of entries) {
    for (const line of entry.lines) {
      const row = summary.get(line.accountId) ?? { debit: 0, credit: 0 };
      row.debit += num(line.debit);
      row.credit += num(line.credit);
      summary.set(line.accountId, row);
    }
  }

  const accounts = await db.account.findMany({
    where: { organizationId, id: { in: [...summary.keys()] } },
  });
  const map = new Map(accounts.map((a) => [a.id, a]));

  const rows = [...summary.entries()].map(([accountId, vals]) => {
    const account = map.get(accountId);
    return {
      code: account?.code ?? accountId,
      name: account?.name ?? "Unknown",
      debit: Math.round(vals.debit * 100) / 100,
      credit: Math.round(vals.credit * 100) / 100,
    };
  });

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}

export async function getGeneralLedger(organizationId: string, accountId?: string) {
  const lines = await db.journalEntryLine.findMany({
    where: {
      ...(accountId ? { accountId } : {}),
      journalEntry: { is: { organizationId, status: "posted" } },
    },
    include: {
      journalEntry: true,
      account: true,
    },
    orderBy: { journalEntry: { date: "asc" } },
  });

  let running = 0;
  return lines.map((line) => {
    running += num(line.debit) - num(line.credit);
    return {
      date: line.journalEntry.date,
      entryNumber: line.journalEntry.entryNumber,
      reference: line.journalEntry.reference,
      description: line.description,
      accountCode: line.account.code,
      accountName: line.account.name,
      debit: num(line.debit),
      credit: num(line.credit),
      runningBalance: Math.round(running * 100) / 100,
    };
  });
}