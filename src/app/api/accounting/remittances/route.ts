import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { postRemittance } from "@/services/accounting/journal";
import { getGeneralLedger } from "@/services/accounting/reports";

// Statutory & payroll liability accounts that can be remitted to authorities.
const LIABILITY_ACCOUNTS: Array<{ code: string; label: string }> = [
  { code: "2200", label: "PAYE Tax Payable" },
  { code: "2300", label: "Pension Payable" },
  { code: "2350", label: "NHIA/HMO Payable" },
  { code: "2400", label: "Other Statutory Deductions" },
  { code: "2450", label: "Employee Reimbursements Payable" },
  { code: "2500", label: "Sales Tax / VAT Payable" },
];

export async function GET() {
  const res = await getApiContext("accounting.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const ledger = await getGeneralLedger(ctx.organizationId);

  // net debit per account (liability balance = credit side)
  const net = new Map<string, number>();
  for (const row of ledger) {
    const current = net.get(row.accountCode) ?? 0;
    net.set(row.accountCode, current + (row.debit - row.credit));
  }

  const accounts = await db.account.findMany({
    where: {
      organizationId: ctx.organizationId,
      code: { in: LIABILITY_ACCOUNTS.map((a) => a.code) },
    },
    select: { id: true, code: true, name: true },
  });
  const accountMap = new Map(accounts.map((a) => [a.code, a]));

  const balances = LIABILITY_ACCOUNTS.map((def) => {
    const account = accountMap.get(def.code);
    const netDebit = net.get(def.code) ?? 0;
    return {
      code: def.code,
      name: account?.name ?? def.label,
      accountId: account?.id ?? null,
      balance: Math.round(-netDebit * 100) / 100, // positive = liability owed
    };
  });

  const recent = await db.journalEntry.findMany({
    where: { organizationId: ctx.organizationId, source: "remittance", status: "posted" },
    include: {
      lines: { include: { account: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { date: "desc" },
    take: 20,
  });

  return apiOk({ balances, recent });
}

const remittanceSchema = z.object({
  code: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().min(1),
  reference: z.string().optional(),
});

export async function POST(req: Request) {
  const res = await getApiContext("accounting.journal");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = remittanceSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  try {
    const entryId = await postRemittance({
      organizationId: ctx.organizationId,
      code: parsed.data.code,
      amount: parsed.data.amount,
      date: new Date(parsed.data.date),
      reference: parsed.data.reference ?? undefined,
      userId: ctx.userId,
    });

    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "post_remittance",
      entity: "account",
      entityId: parsed.data.code,
      metadata: { amount: parsed.data.amount, entryId },
    });

    return apiOk({ journalEntryId: entryId }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to post remittance";
    return apiError(message, 400);
  }
}