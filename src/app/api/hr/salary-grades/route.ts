import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  minAmount: z.number().nonnegative(),
  maxAmount: z.number().nonnegative(),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const res = await getApiContext("employees.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const grades = await db.salaryGrade.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { minAmount: "asc" },
  });
  return apiOk({ grades });
}

export async function POST(req: Request) {
  const res = await getApiContext("employees.payroll");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  try {
    const grade = await db.salaryGrade.create({
      data: {
        organizationId: ctx.organizationId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        minAmount: parsed.data.minAmount,
        maxAmount: parsed.data.maxAmount,
        isActive: parsed.data.isActive,
      },
    });
    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "create",
      entity: "salary_grade",
      entityId: grade.id,
    });
    return apiOk({ grade }, 201);
  } catch {
    return apiError("Failed to create salary grade", 500);
  }
}

const patchSchema = schema.partial().extend({ isActive: z.boolean().optional() });

export async function PATCH(req: Request) {
  const res = await getApiContext("employees.payroll");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return apiError("id is required");

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const grade = await db.salaryGrade.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!grade) return apiError("Salary grade not found", 404);

  const updated = await db.salaryGrade.update({ where: { id }, data: parsed.data });
  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "salary_grade",
    entityId: id,
  });
  return apiOk({ grade: updated });
}

export async function DELETE(req: Request) {
  const res = await getApiContext("employees.payroll");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return apiError("id is required");

  const grade = await db.salaryGrade.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!grade) return apiError("Salary grade not found", 404);

  await db.salaryGrade.update({ where: { id }, data: { isActive: false } });
  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "delete",
    entity: "salary_grade",
    entityId: id,
  });
  return apiOk({ ok: true });
}