import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await getApiContext("employees.view");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const employee = await db.employee.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      department: true,
      position: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
      salaryStructures: { orderBy: { effectiveFrom: "desc" } },
      documents: true,
      leaves: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!employee) return apiError("Employee not found", 404);
  return apiOk({ employee });
}

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  departmentId: z.string().optional().nullable(),
  positionId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  status: z.string().optional(),
  employmentType: z.string().optional(),
  hireDate: z.string().nullable().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName: z.string().optional(),
  tin: z.string().optional(),
  ssn: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await getApiContext("employees.edit");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const employee = await db.employee.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!employee) return apiError("Employee not found", 404);

  const data = parsed.data;
  const updated = await db.employee.update({
    where: { id },
    data: {
      ...(data.firstName ? { firstName: data.firstName } : {}),
      ...(data.lastName ? { lastName: data.lastName } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
      ...(data.departmentId !== undefined ? { departmentId: data.departmentId || null } : {}),
      ...(data.positionId !== undefined ? { positionId: data.positionId || null } : {}),
      ...(data.managerId !== undefined ? { managerId: data.managerId || null } : {}),
      ...(data.status ? { status: data.status, isActive: data.status !== "terminated" } : {}),
      ...(data.employmentType ? { employmentType: data.employmentType } : {}),
      ...(data.hireDate !== undefined ? { hireDate: data.hireDate ? new Date(data.hireDate) : null } : {}),
      ...(data.bankName !== undefined ? { bankName: data.bankName || null } : {}),
      ...(data.bankAccountNumber !== undefined ? { bankAccountNumber: data.bankAccountNumber || null } : {}),
      ...(data.bankAccountName !== undefined ? { bankAccountName: data.bankAccountName || null } : {}),
      ...(data.tin !== undefined ? { tin: data.tin || null } : {}),
      ...(data.ssn !== undefined ? { ssn: data.ssn || null } : {}),
    },
    include: {
      department: true,
      position: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
      salaryStructures: { where: { isActive: true }, take: 1 },
    },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "update",
    entity: "employee",
    entityId: updated.id,
    metadata: { changes: parsed.data },
  });

  return apiOk({ employee: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const res = await getApiContext("employees.delete");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const { id } = await params;

  const employee = await db.employee.findFirst({
    where: { id, organizationId: ctx.organizationId },
  });
  if (!employee) return apiError("Employee not found", 404);

  await db.employee.update({ where: { id }, data: { isActive: false, status: "terminated" } });
  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "delete",
    entity: "employee",
    entityId: id,
  });
  return apiOk({ ok: true });
}