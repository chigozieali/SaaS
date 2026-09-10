import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("employees.view");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const employee = await db.employee.findFirst({
    where: { id, organizationId: ctx.organizationId },
    select: { id: true },
  });
  if (!employee) return apiError("Employee not found", 404);

  const plans = await db.benefitPlan.findMany({
    where: { organizationId: ctx.organizationId, isActive: true },
    orderBy: { name: "asc" },
  });
  const enrollments = await db.employeeBenefit.findMany({
    where: { employeeId: id },
    include: { plan: true },
  });
  return apiOk({ plans, enrollments });
}

const putSchema = z.object({
  enrollments: z.array(
    z.object({
      planId: z.string().min(1),
      coverageTier: z.string().optional(),
      employeeContribution: z.number().optional().nullable(),
    })
  ),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const res = await getApiContext("employees.payroll");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const employee = await db.employee.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!employee) return apiError("Employee not found", 404);

  const planIds = [...new Set(parsed.data.enrollments.map((e) => e.planId))];
  if (planIds.length !== parsed.data.enrollments.length) {
    return apiError("Duplicate benefit plan enrollment");
  }
  const plans = await db.benefitPlan.findMany({
    where: { id: { in: planIds }, organizationId: ctx.organizationId },
  });
  if (plans.length !== planIds.length) return apiError("Unknown benefit plan");

  for (const plan of plans) {
    if (plan.requiresConfirmation && !employee.isConfirmed) {
      return apiError(`${plan.name} requires confirmed staff`);
    }
  }

  await db.$transaction(async (tx) => {
    await tx.employeeBenefit.deleteMany({ where: { employeeId: id } });
    for (const entry of parsed.data.enrollments) {
      await tx.employeeBenefit.create({
        data: {
          employeeId: id,
          planId: entry.planId,
          coverageTier: entry.coverageTier || null,
          employeeContribution: entry.employeeContribution ?? null,
          isActive: true,
        },
      });
    }
  }, { timeout: 30_000 });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "employee_benefits",
    entityId: id,
    metadata: { planIds },
  });

  return apiOk({ ok: true });
}