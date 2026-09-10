import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const journalInclude = {
  lines: { include: { account: true } },
  period: true,
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  postedBy: { select: { id: true, name: true } },
  reversedBy: { select: { id: true, name: true } },
  reversalOf: { select: { id: true, entryNumber: true, date: true, status: true } },
  reversals: { select: { id: true, entryNumber: true, date: true, status: true } },
} as const;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("accounting.journal");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const entry = await db.journalEntry.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: journalInclude,
  });
  if (!entry) return apiError("Journal entry not found", 404);
  return apiOk({ entry });
}

// Edit a draft / pending entry. Replaces the lines when `lines` is provided.
const editSchema = z.object({
  date: z.string().optional(),
  reference: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  lines: z
    .array(
      z.object({
        accountCode: z.string().min(1),
        description: z.string().optional(),
        debit: z.number().optional().default(0),
        credit: z.number().optional().default(0),
      })
    )
    .min(2)
    .optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await getApiContext("accounting.journal");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const entry = await db.journalEntry.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: { lines: true },
  });
  if (!entry) return apiError("Journal entry not found", 404);
  if (entry.status !== "draft" && entry.status !== "pending") {
    return apiError("Only draft or pending entries can be edited");
  }

  const body = await req.json().catch(() => null);
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid input");

  const data: {
    date?: Date;
    reference?: string | null;
    description?: string | null;
  } = {};
  if (parsed.data.date) data.date = new Date(parsed.data.date);
  if (parsed.data.reference !== undefined) data.reference = parsed.data.reference ?? null;
  if (parsed.data.description !== undefined) data.description = parsed.data.description ?? null;

  const updated = await db.$transaction(async (tx) => {
    if (parsed.data.lines) {
      // Re-validate account codes and double-entry balance.
      const codes = parsed.data.lines.map((l) => l.accountCode);
      const accounts = await tx.account.findMany({
        where: { organizationId: ctx.organizationId, code: { in: codes } },
      });
      const accountMap = new Map(accounts.map((a) => [a.code, a.id]));
      for (const l of parsed.data.lines) {
        if (!accountMap.has(l.accountCode)) throw new Error(`Account ${l.accountCode} not found`);
      }
      const debits = parsed.data.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
      const credits = parsed.data.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
      if (Math.abs(debits - credits) > 0.01) {
        throw new Error("Journal is out of balance: debits must equal credits");
      }

      await tx.journalEntry.update({
        where: { id },
        data: {
          ...data,
          lines: {
            deleteMany: {},
            create: parsed.data.lines.map((l) => ({
              accountId: accountMap.get(l.accountCode)!,
              description: l.description,
              debit: l.debit ?? 0,
              credit: l.credit ?? 0,
            })),
          },
        },
      });
    } else {
      await tx.journalEntry.update({ where: { id }, data });
    }
    return tx.journalEntry.findUnique({ where: { id }, include: journalInclude });
  }, { timeout: 120_000 });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "edit_journal",
    entity: "journal_entry",
    entityId: id,
  });

  return apiOk({ entry: updated });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("accounting.journal");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const entry = await db.journalEntry.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!entry) return apiError("Journal entry not found", 404);
  if (entry.status !== "draft" && entry.status !== "pending") {
    return apiError("Only draft or pending entries can be deleted");
  }

  await db.journalEntry.delete({ where: { id } });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "delete_journal",
    entity: "journal_entry",
    entityId: id,
  });

  return apiOk({ ok: true });
}

// ---------------------------------------------------------------
// Workflow actions: submit / approve / post / reverse
// ---------------------------------------------------------------
const actionSchema = z.object({
  action: z.enum(["submit", "approve", "post", "reverse"]),
  date: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("accounting.journal");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid input");

  const entry = await db.journalEntry.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: { lines: true, period: true },
  });
  if (!entry) return apiError("Journal entry not found", 404);

  const entryNumber = (suffix: string) =>
    `JE-${Date.now().toString().slice(-8)}${suffix}`;

  try {
    switch (parsed.data.action) {
      case "submit": {
        if (entry.status !== "draft") return apiError("Only draft entries can be submitted");
        const updated = await db.journalEntry.update({
          where: { id },
          data: { status: "pending" },
          include: journalInclude,
        });
        await auditLog({ organizationId: ctx.organizationId, userId: ctx.userId, action: "submit_journal", entity: "journal_entry", entityId: id });
        return apiOk({ entry: updated });
      }

      case "approve": {
        if (entry.status !== "pending") return apiError("Only pending entries can be approved");
        const updated = await db.journalEntry.update({
          where: { id },
          data: { status: "approved", approvedById: ctx.userId, approvedAt: new Date() },
          include: journalInclude,
        });
        await auditLog({ organizationId: ctx.organizationId, userId: ctx.userId, action: "approve_journal", entity: "journal_entry", entityId: id });
        return apiOk({ entry: updated });
      }

      case "post": {
        if (entry.status !== "approved") return apiError("Only approved entries can be posted");
        await assertPeriodOpen(ctx.organizationId, entry.date);

        const updated = await db.journalEntry.update({
          where: { id },
          data: { status: "posted", postedById: ctx.userId, postedAt: new Date() },
          include: journalInclude,
        });
        await auditLog({ organizationId: ctx.organizationId, userId: ctx.userId, action: "post_journal", entity: "journal_entry", entityId: id });
        return apiOk({ entry: updated });
      }

      case "reverse": {
        if (entry.status !== "posted") return apiError("Only posted entries can be reversed");

        const reversalDate = parsed.data.date ? new Date(parsed.data.date) : new Date();
        await assertPeriodOpen(ctx.organizationId, reversalDate);

        if (entry.period?.isClosed) {
          return apiError(`Accounting period "${entry.period.name}" is closed`);
        }

        const result = await db.$transaction(async (tx) => {
          const reversalPeriod = await tx.accountingPeriod.findFirst({
            where: {
              organizationId: ctx.organizationId,
              startDate: { lte: reversalDate },
              endDate: { gte: reversalDate },
            },
            orderBy: { startDate: "desc" },
          });
          if (reversalPeriod?.isClosed) {
            throw new Error(`Accounting period "${reversalPeriod.name}" is closed`);
          }

          const reversal = await tx.journalEntry.create({
            data: {
              organizationId: ctx.organizationId,
              periodId: reversalPeriod?.id ?? null,
              entryNumber: entryNumber("-REV"),
              date: reversalDate,
              reference: parsed.data.description ?? `Reversal of ${entry.entryNumber}`,
              description: parsed.data.description ?? `Reversal of ${entry.entryNumber} (${entry.description ?? ""})`.trim(),
              status: "posted",
              source: "reversal",
              createdById: ctx.userId,
              postedById: ctx.userId,
              postedAt: new Date(),
              reversalOfId: entry.id,
              lines: {
                create: entry.lines.map((l) => ({
                  accountId: l.accountId,
                  description: l.description,
                  debit: num(l.credit),
                  credit: num(l.debit),
                })),
              },
            },
          });

          const original = await tx.journalEntry.update({
            where: { id },
            data: { status: "reversed", reversedById: ctx.userId, reversedAt: new Date() },
            include: journalInclude,
          });

          return { reversal, original };
        }, { timeout: 120_000 });

        await auditLog({ organizationId: ctx.organizationId, userId: ctx.userId, action: "reverse_journal", entity: "journal_entry", entityId: id });
        return apiOk({
          entry: result.original,
          reversal: result.reversal,
        });
      }

      default:
        return apiError("Unknown action");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed";
    return apiError(message, 400);
  }
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function assertPeriodOpen(organizationId: string, date: Date) {
  const period = await db.accountingPeriod.findFirst({
    where: {
      organizationId,
      startDate: { lte: date },
      endDate: { gte: date },
    },
    orderBy: { startDate: "desc" },
  });
  if (period?.isClosed) {
    throw new Error(`Accounting period "${period.name}" is closed. Open or extend the period first.`);
  }
}