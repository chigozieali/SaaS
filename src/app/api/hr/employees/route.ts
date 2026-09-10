import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { provisionEmployeeAccount } from "@/lib/provision";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";

const payrollFields = [
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
  "salaryBasic",
  "salaryAllowances",
] as const;

const employeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  location: z.string().optional(),
  dateOfBirth: z.string().optional().nullable(),
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
  hireDate: z.string().optional().nullable(),
  employmentType: z.string().default("permanent"),
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
  payFrequency: z.string().default("monthly"),
  salaryGradeId: z.string().optional().nullable(),
  salaryBasic: z.number().optional(),
  salaryAllowances: z.record(z.string(), z.number()).optional(),
});

export async function GET() {
  const res = await getApiContext("employees.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const employees = await db.employee.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      department: true,
      position: true,
      salaryGrade: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
      salaryStructures: { where: { isActive: true }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiOk({ employees });
}

export async function POST(req: Request) {
  const res = await getApiContext("employees.create");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = employeeSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const canPayroll = hasPermission(ctx.permissions, PERMISSIONS.employees.payroll);
  const hasPayrollData = payrollFields.some((k) => {
    const v = (parsed.data as Record<string, unknown>)[k];
    return v !== undefined && v !== null && v !== "" && v !== 0 && !(Array.isArray(v) && v.length === 0);
  });
  if (hasPayrollData && !canPayroll) {
    return apiError("You need the payroll permission to set compensation or bank details", 403);
  }

  const data = parsed.data;

  const count = await db.employee.count({ where: { organizationId: ctx.organizationId } });
  const employeeCode = `EMP-${String(count + 1).padStart(4, "0")}`;

  try {
    const result = await db.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          organizationId: ctx.organizationId,
          employeeCode,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          location: data.location || null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          gender: data.gender || null,
          maritalStatus: data.maritalStatus || null,
          nationality: data.nationality || null,
          nextOfKinName: data.nextOfKinName || null,
          nextOfKinPhone: data.nextOfKinPhone || null,
          nextOfKinRelation: data.nextOfKinRelation || null,
          isConfirmed: data.isConfirmed ?? false,
          departmentId: data.departmentId || null,
          positionId: data.positionId || null,
          managerId: data.managerId || null,
          hireDate: data.hireDate ? new Date(data.hireDate) : null,
          employmentType: data.employmentType,
          bankName: data.bankName || null,
          bankAccountNumber: data.bankAccountNumber || null,
          bankAccountName: data.bankAccountName || null,
          tin: data.tin || null,
          taxOffice: data.taxOffice || null,
          pfaName: data.pfaName || null,
          rsaPin: data.rsaPin || null,
          pensionPct: data.pensionPct ?? null,
          hmoPlan: data.hmoPlan || null,
          nhiaPct: data.nhiaPct ?? null,
          payFrequency: data.payFrequency || "monthly",
          salaryGradeId: data.salaryGradeId || null,
        },
      });

      if (data.salaryBasic) {
        await tx.salaryStructure.create({
          data: {
            employeeId: emp.id,
            basicSalary: data.salaryBasic,
            allowances: (data.salaryAllowances ?? {}) as never,
            effectiveFrom: new Date(),
            isActive: true,
          },
        });
        await tx.salaryChange.create({
          data: {
            employeeId: emp.id,
            newBasic: data.salaryBasic,
            effectiveFrom: new Date(),
            reason: "Initial salary",
            changedById: ctx.userId,
          },
        });
      }

      const account = await provisionEmployeeAccount(tx, {
        organizationId: ctx.organizationId,
        employeeId: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
      });

      return { employee: emp, account };
    }, { timeout: 30_000 });

    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "create",
      entity: "employee",
      entityId: result.employee.id,
      metadata: { employeeCode },
    });

    return apiOk({ employee: result.employee, account: result.account }, 201);
  } catch (error) {
    console.error(error);
    return apiError("Failed to create employee", 500);
  }
}