import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";

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
      salaryGrade: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
      salaryStructures: { orderBy: { effectiveFrom: "desc" } },
      salaryChanges: { orderBy: { changedAt: "desc" } },
      benefitEnrollments: { include: { plan: true } },
      documents: { orderBy: { createdAt: "desc" } },
      disciplinaryRecords: { orderBy: { incidentDate: "desc" } },
      acknowledgements: { orderBy: { acknowledgedAt: "desc" } },
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
  address: z.string().optional(),
  location: z.string().optional(),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.string().optional(),
  maritalStatus: z.string().optional(),
  nationality: z.string().optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  nextOfKinRelation: z.string().optional(),
  isConfirmed: z.boolean().optional(),
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
  taxOffice: z.string().optional(),
  pfaName: z.string().optional(),
  rsaPin: z.string().optional(),
  pensionPct: z.number().optional().nullable(),
  hmoPlan: z.string().optional(),
  nhiaPct: z.number().optional().nullable(),
  payFrequency: z.string().optional(),
  salaryGradeId: z.string().optional().nullable(),
});

const payrollOwned = new Set([
  "bankName",
  "bankAccountNumber",
  "bankAccountName",
  "tin",
  "taxOffice",
  "pfaName",
  "rsaPin",
  "pensionPct",
  "hmoPlan",
  "nhiaPct",
  "payFrequency",
  "salaryGradeId",
]);

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

  // Payroll-owned fields (compensation, bank, tax, pension) need employees.payroll.
  const keys = Object.keys(parsed.data);
  const touchesPayroll = keys.some((k) => payrollOwned.has(k));
  if (touchesPayroll && !hasPermission(ctx.permissions, PERMISSIONS.employees.payroll)) {
    return apiError("You need the payroll permission to edit compensation or bank details", 403);
  }

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
      ...(data.address !== undefined ? { address: data.address || null } : {}),
      ...(data.location !== undefined ? { location: data.location || null } : {}),
      ...(data.dateOfBirth !== undefined ? { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null } : {}),
      ...(data.gender !== undefined ? { gender: data.gender || null } : {}),
      ...(data.maritalStatus !== undefined ? { maritalStatus: data.maritalStatus || null } : {}),
      ...(data.nationality !== undefined ? { nationality: data.nationality || null } : {}),
      ...(data.nextOfKinName !== undefined ? { nextOfKinName: data.nextOfKinName || null } : {}),
      ...(data.nextOfKinPhone !== undefined ? { nextOfKinPhone: data.nextOfKinPhone || null } : {}),
      ...(data.nextOfKinRelation !== undefined ? { nextOfKinRelation: data.nextOfKinRelation || null } : {}),
      ...(data.isConfirmed !== undefined ? { isConfirmed: data.isConfirmed } : {}),
      ...(data.departmentId !== undefined ? { departmentId: data.departmentId || null } : {}),
      ...(data.positionId !== undefined ? { positionId: data.positionId || null } : {}),
      ...(data.managerId !== undefined ? { managerId: data.managerId || null } : {}),
      ...(data.status ? { status: data.status, isActive: data.status !== "terminated", terminationDate: data.status === "terminated" ? new Date() : undefined } : {}),
      ...(data.employmentType ? { employmentType: data.employmentType } : {}),
      ...(data.hireDate !== undefined ? { hireDate: data.hireDate ? new Date(data.hireDate) : null } : {}),
      ...(data.bankName !== undefined ? { bankName: data.bankName || null } : {}),
      ...(data.bankAccountNumber !== undefined ? { bankAccountNumber: data.bankAccountNumber || null } : {}),
      ...(data.bankAccountName !== undefined ? { bankAccountName: data.bankAccountName || null } : {}),
      ...(data.tin !== undefined ? { tin: data.tin || null } : {}),
      ...(data.taxOffice !== undefined ? { taxOffice: data.taxOffice || null } : {}),
      ...(data.pfaName !== undefined ? { pfaName: data.pfaName || null } : {}),
      ...(data.rsaPin !== undefined ? { rsaPin: data.rsaPin || null } : {}),
      ...(data.pensionPct !== undefined ? { pensionPct: data.pensionPct ?? null } : {}),
      ...(data.hmoPlan !== undefined ? { hmoPlan: data.hmoPlan || null } : {}),
      ...(data.nhiaPct !== undefined ? { nhiaPct: data.nhiaPct ?? null } : {}),
      ...(data.payFrequency !== undefined ? { payFrequency: data.payFrequency || "monthly" } : {}),
      ...(data.salaryGradeId !== undefined ? { salaryGradeId: data.salaryGradeId || null } : {}),
    },
    include: {
      department: true,
      position: true,
      salaryGrade: true,
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