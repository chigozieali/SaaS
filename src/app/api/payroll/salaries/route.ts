import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  employeeId: z.string().min(1),
  basicSalary: z.number().positive(),
  allowances: z.record(z.string(), z.number()).optional(),
  effectiveFrom: z.string().min(1),
});

export async function GET() {
  const res = await getApiContext("payroll.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const structures = await db.salaryStructure.findMany({
    where: { employee: { organizationId: ctx.organizationId } },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return apiOk({ structures });
}

export async function POST(req: Request) {
  const res = await getApiContext("payroll.configure");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const employee = await db.employee.findFirst({
    where: { id: parsed.data.employeeId, organizationId: ctx.organizationId },
  });
  if (!employee) return apiError("Employee not found", 404);

  // deactivate existing active structures
  await db.salaryStructure.updateMany({
    where: { employeeId: employee.id, isActive: true },
    data: { isActive: false, effectiveTo: new Date(parsed.data.effectiveFrom) },
  });

  const structure = await db.salaryStructure.create({
    data: {
      employeeId: employee.id,
      basicSalary: parsed.data.basicSalary,
      allowances: (parsed.data.allowances ?? {}) as never,
      effectiveFrom: new Date(parsed.data.effectiveFrom),
      isActive: true,
    },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "create",
    entity: "salary_structure",
    entityId: structure.id,
  });

  return apiOk({ structure }, 201);
}