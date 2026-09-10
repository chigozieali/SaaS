import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import {
  bookExpenseApproval,
  payExpenseViaBank,
} from "@/services/accounting/journal";

type Ctx = { organizationId: string; userId: string };

const schema = z.object({
  status: z.enum(["approved", "rejected", "cancelled"]).optional(),
  pay: z
    .object({
      method: z.enum(["bank", "payroll"]),
      date: z.string().optional(),
      reference: z.string().optional(),
      runId: z.string().nullable().optional(),
    })
    .optional(),
});

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
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const expense = await db.expense.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!expense) return apiError("Expense not found", 404);

  try {
    if (parsed.data.pay) {
      return await handlePayment(parsed.data.pay, expense, ctx);
    }
    if (parsed.data.status) {
      return await handleStatus(parsed.data.status, expense, ctx);
    }
    return apiError("Nothing to update");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update expense";
    return apiError(message, 400);
  }
}

async function handleStatus(
  status: string,
  expense: { id: string; status: string },
  ctx: Ctx
) {
  if (expense.status !== "pending") {
    return apiError(`Cannot set status "${status}" on expense in status "${expense.status}"`);
  }

  if (status === "approved") {
    await db.expense.update({
      where: { id: expense.id },
      data: { status: "approved", approvedById: ctx.userId, approvedAt: new Date() },
    });
    let journalEntryId: string;
    try {
      journalEntryId = await bookExpenseApproval({
        organizationId: ctx.organizationId,
        expenseId: expense.id,
        userId: ctx.userId,
      });
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "Failed to book expense", 400);
    }
    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "expense_approved",
      entity: "expense",
      entityId: expense.id,
      metadata: { journalEntryId },
    });
    return apiOk({ expense: { ...expense, status: "approved", journalEntryId } });
  }

  const updated = await db.expense.update({
    where: { id: expense.id },
    data: { status, approvedById: null, approvedAt: null },
  });
  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: `expense_${status}`,
    entity: "expense",
    entityId: expense.id,
    metadata: { from: expense.status },
  });
  return apiOk({ expense: updated });
}

async function handlePayment(
  pay: { method: string; date?: string; reference?: string; runId?: string | null },
  expense: { id: string; status: string; employeeId: string | null; paidAt: Date | null },
  ctx: Ctx
) {
  if (expense.status !== "approved") {
    return apiError("Only approved expenses can be paid");
  }
  if (expense.paidAt) return apiError("Expense is already paid");

  if (pay.method === "bank") {
    const entryId = await payExpenseViaBank({
      organizationId: ctx.organizationId,
      expenseId: expense.id,
      userId: ctx.userId,
      date: pay.date ? new Date(pay.date) : undefined,
      reference: pay.reference,
    });
    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "expense_paid_bank",
      entity: "expense",
      entityId: expense.id,
      metadata: { entryId },
    });
    return apiOk({ expense: { id: expense.id, status: "paid", journalEntryId: entryId } });
  }

  // Pay via payroll: attach the claim to an open payroll run so it becomes a
  // net-pay top-up on that run. runId = null detaches it again.
  if (!expense.employeeId) {
    return apiError("Only employee expense claims can be paid via payroll");
  }
  const targetRunId = pay.runId ?? null;
  if (targetRunId) {
    const run = await db.payrollRun.findFirst({
      where: { id: targetRunId, organizationId: ctx.organizationId },
    });
    if (!run) return apiError("Payroll run not found", 404);
    if (!["draft", "submitted"].includes(run.status)) {
      return apiError(
        `Cannot attach expense to run in status "${run.status}". Attach before the run is approved.`
      );
    }
  }

  const updated = await db.expense.update({
    where: { id: expense.id },
    data: {
      payrollRunId: targetRunId,
      reimbursementMethod: "payroll",
    },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: targetRunId ? "expense_attach_payroll" : "expense_detach_payroll",
    entity: "expense",
    entityId: expense.id,
    metadata: { payrollRunId: targetRunId },
  });

  return apiOk({ expense: updated });
}