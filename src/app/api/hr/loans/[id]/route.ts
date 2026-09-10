import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { disburseStaffLoan } from "@/services/accounting/journal";

const schema = z.object({
  action: z.enum(["approve", "reject", "disburse", "mark-paid-off"]),
  date: z.string().optional(),
});

function num(v: { toNumber(): number } | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return v.toNumber();
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await getApiContext("payroll.configure");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const loan = await db.staffLoan.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!loan) return apiError("Loan not found", 404);

  try {
    let result: Record<string, unknown> = { id, status: loan.status };
    let action = parsed.data.action;

    switch (action) {
      case "approve":
        if (loan.status !== "pending") return apiError(`Cannot approve loan in status "${loan.status}"`);
        result = await db.staffLoan.update({
          where: { id },
          data: { status: "approved", approvedById: ctx.userId, approvedAt: new Date() },
        });
        break;
      case "reject":
        if (!["pending"].includes(loan.status)) return apiError(`Cannot reject loan in status "${loan.status}"`);
        result = await db.staffLoan.update({
          where: { id },
          data: { status: "rejected" },
        });
        break;
      case "disburse": {
        if (loan.status !== "approved") return apiError("Loan must be approved before disbursement");
        const entryId = await disburseStaffLoan({
          organizationId: ctx.organizationId,
          loanId: id,
          userId: ctx.userId,
          date: parsed.data.date ? new Date(parsed.data.date) : undefined,
        });
        result = { id, status: "active", journalEntryId: entryId };
        break;
      }
      case "mark-paid-off":
        if (!["active"].includes(loan.status)) return apiError(`Cannot write off loan in status "${loan.status}"`);
        result = await db.staffLoan.update({
          where: { id },
          data: { status: "paid_off", outstandingBalance: 0 },
        });
        break;
    }

    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action,
      entity: "staff_loan",
      entityId: loan.id,
      metadata: { from: loan.status, to: result.status },
    });

    return apiOk({ loan: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operation failed";
    return apiError(message, 400);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await getApiContext("payroll.view");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const loan = await db.staffLoan.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      repayments: { orderBy: { paidAt: "desc" } },
    },
  });
  if (!loan) return apiError("Loan not found", 404);

  return apiOk({
    loan: {
      ...loan,
      totalRepaid: loan.repayments.reduce((s, r) => s + num(r.amount), 0),
    },
  });
}