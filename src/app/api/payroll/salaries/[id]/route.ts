import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const schema = z.object({
  basicSalary: z.number().positive().optional(),
  allowances: z.record(z.string(), z.number()).optional(),
  effectiveFrom: z.string().min(1).optional(),
});

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

  const structure = await db.salaryStructure.findFirst({
    where: { id, employee: { organizationId: ctx.organizationId }, isActive: true },
  });
  if (!structure) return apiError("Active salary structure not found", 404);

  const data = parsed.data;
  const updated = await db.salaryStructure.update({
    where: { id },
    data: {
      ...(data.basicSalary !== undefined ? { basicSalary: data.basicSalary } : {}),
      ...(data.allowances !== undefined ? { allowances: data.allowances as never } : {}),
      ...(data.effectiveFrom ? { effectiveFrom: new Date(data.effectiveFrom) } : {}),
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
    },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "salary_structure",
    entityId: id,
    metadata: { changes: parsed.data },
  });

  return apiOk({ structure: updated });
}