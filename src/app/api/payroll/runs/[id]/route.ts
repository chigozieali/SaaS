import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { finalizePayrollRun } from "@/services/payroll/service";
import { postPayrollToAccounting } from "@/services/accounting/journal";
import { notifyUsersByEmail } from "@/lib/notify";

const actionSchema = z.object({
  action: z.enum(["submit", "approve", "finalize", "post", "reopen"]),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await getApiContext("payroll.view");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const run = await db.payrollRun.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      period: true,
      lines: {
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeCode: true, bankAccountNumber: true },
          },
        },
      },
    },
  });
  if (!run) return apiError("Payroll run not found", 404);
  return apiOk({ run });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await getApiContext("payroll.finalize");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid action");

  const run = await db.payrollRun.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!run) return apiError("Payroll run not found", 404);

  try {
    let result;
    switch (parsed.data.action) {
      case "submit":
        if (!["draft", "reopened"].includes(run.status)) {
          return apiError(`Cannot submit run in status "${run.status}"`);
        }
        result = await db.payrollRun.update({
          where: { id },
          data: { status: "submitted", submittedAt: new Date(), submittedById: ctx.userId },
        });
        break;
      case "approve": {
        if (run.status !== "submitted") {
          return apiError("Only submitted runs can be approved");
        }
        result = await db.payrollRun.update({
          where: { id },
          data: { status: "approved", approvedAt: new Date(), approvedById: ctx.userId },
        });
        break;
      }
      case "finalize": {
        if (run.status !== "approved") {
          return apiError("Only approved runs can be finalized");
        }
        result = await finalizePayrollRun(id, ctx.organizationId, ctx.userId);

        const lines = await db.payrollRunLine.findMany({
          where: { runId: id },
          select: { employee: { select: { email: true } } },
        });
        const period = await db.payrollPeriod.findUnique({
          where: { id: run.periodId },
          select: { name: true },
        });
        await notifyUsersByEmail(
          ctx.organizationId,
          lines.map((l) => l.employee.email ?? ""),
          {
            title: "New payslip available",
            message: `Your payslip for ${period?.name ?? "this period"} is ready to view.`,
            type: "success",
            link: "/hr/my-payslips",
          }
        );
        break;
      }
      case "post": {
        const entryId = await postPayrollToAccounting({
          organizationId: ctx.organizationId,
          runId: id,
          userId: ctx.userId,
        });
        result = { id, journalEntryId: entryId, status: "posted" };
        break;
      }
      case "reopen":
        if (!["finalized", "posted"].includes(run.status)) {
          return apiError("Only finalized runs can be reopened");
        }
        return apiError("Finalized payroll cannot be reopened. Create an adjustment run instead.", 400);
      default:
        return apiError("Unknown action");
    }

    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: parsed.data.action,
      entity: "payroll_run",
      entityId: id,
      metadata: { from: run.status },
    });

    return apiOk({ run: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operation failed";
    return apiError(message, 400);
  }
}