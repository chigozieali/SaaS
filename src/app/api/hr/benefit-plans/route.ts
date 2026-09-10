import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  name: z.string().min(1),
  type: z.string().default("hmo"),
  description: z.string().optional(),
  requiresConfirmation: z.boolean().default(false),
  employerSharePct: z.number().optional().nullable(),
  employeeSharePct: z.number().optional().nullable(),
  premium: z.number().optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const res = await getApiContext("employees.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const plans = await db.benefitPlan.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { name: "asc" },
  });
  return apiOk({ plans });
}

export async function POST(req: Request) {
  const res = await getApiContext("employees.payroll");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  try {
    const plan = await db.benefitPlan.create({
      data: {
        organizationId: ctx.organizationId,
        name: parsed.data.name,
        type: parsed.data.type,
        description: parsed.data.description || null,
        requiresConfirmation: parsed.data.requiresConfirmation,
        employerSharePct: parsed.data.employerSharePct ?? null,
        employeeSharePct: parsed.data.employeeSharePct ?? null,
        premium: parsed.data.premium ?? null,
        isActive: parsed.data.isActive,
      },
    });
    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "create",
      entity: "benefit_plan",
      entityId: plan.id,
    });
    return apiOk({ plan }, 201);
  } catch {
    return apiError("Failed to create benefit plan", 500);
  }
}

const patchSchema = schema.partial();

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

  const plan = await db.benefitPlan.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!plan) return apiError("Benefit plan not found", 404);

  const updated = await db.benefitPlan.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.employerSharePct !== undefined ? { employerSharePct: parsed.data.employerSharePct ?? null } : {}),
      ...(parsed.data.employeeSharePct !== undefined ? { employeeSharePct: parsed.data.employeeSharePct ?? null } : {}),
      ...(parsed.data.premium !== undefined ? { premium: parsed.data.premium ?? null } : {}),
    },
  });
  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "benefit_plan",
    entityId: id,
  });
  return apiOk({ plan: updated });
}

export async function DELETE(req: Request) {
  const res = await getApiContext("employees.payroll");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return apiError("id is required");

  const plan = await db.benefitPlan.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!plan) return apiError("Benefit plan not found", 404);

  await db.benefitPlan.update({ where: { id }, data: { isActive: false } });
  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "delete",
    entity: "benefit_plan",
    entityId: id,
  });
  return apiOk({ ok: true });
}