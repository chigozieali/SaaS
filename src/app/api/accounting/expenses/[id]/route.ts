import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const schema = z.object({ status: z.enum(["approved", "rejected", "cancelled"]) });

function num(v: { toNumber(): number } | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return v.toNumber();
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await getApiContext("accounting.expenses");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid status");

  const expense = await db.expense.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!expense) return apiError("Expense not found", 404);

  const approved = parsed.data.status === "approved";

  try {
    const updated = await db.$transaction(async (tx) => {
      const e = await tx.expense.update({
        where: { id },
        data: { status: parsed.data.status, approvedById: approved ? ctx.userId : null },
      });

      if (approved) {
        const category = e.categoryId
          ? await tx.expenseCategory.findUnique({ where: { id: e.categoryId } })
          : null;

        const expenseAccount = category?.accountId
          ? await tx.account.findFirst({
              where: { id: category.accountId, organizationId: ctx.organizationId },
            })
          : null;
        const debitAccount =
          expenseAccount ??
          (await tx.account.findFirst({
            where: { organizationId: ctx.organizationId, type: "expense" },
            orderBy: { code: "asc" },
          }));

        const payableAccount = await tx.account.findFirst({
          where: { organizationId: ctx.organizationId, code: "2000" },
        });

        if (!debitAccount || !payableAccount) {
          throw new Error("Required GL accounts are not set up");
        }

        const count = await tx.journalEntry.count({ where: { organizationId: ctx.organizationId } });
        await tx.journalEntry.create({
          data: {
            organizationId: ctx.organizationId,
            entryNumber: `EXP-${String(count + 1).padStart(4, "0")}`,
            date: e.date,
            reference: `Expense ${e.id.slice(0, 8)}`,
            description: e.description ?? "Expense reimbursement",
            status: "posted",
            source: "expense",
            createdById: ctx.userId,
            lines: {
              create: [
                {
                  accountId: debitAccount.id,
                  description: e.description ?? "Expense reimbursement",
                  debit: num(e.amount),
                },
                {
                  accountId: payableAccount.id,
                  description: "Expense payable",
                  credit: num(e.amount),
                },
              ],
            },
          },
        });
      }

      return e;
    });

    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: `expense_${parsed.data.status}`,
      entity: "expense",
      entityId: expense.id,
      metadata: { from: expense.status },
    });

    return apiOk({ expense: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update expense";
    return apiError(message, 400);
  }
}