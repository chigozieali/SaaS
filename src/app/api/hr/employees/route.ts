import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

const employeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  departmentId: z.string().optional().nullable(),
  positionId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  hireDate: z.string().optional().nullable(),
  employmentType: z.string().default("permanent"),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankAccountName: z.string().optional(),
  tin: z.string().optional(),
  ssn: z.string().optional(),
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

  const data = parsed.data;

  const count = await db.employee.count({ where: { organizationId: ctx.organizationId } });
  const employeeCode = `EMP-${String(count + 1).padStart(4, "0")}`;

  try {
    const employee = await db.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          organizationId: ctx.organizationId,
          employeeCode,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email || null,
          phone: data.phone || null,
          departmentId: data.departmentId || null,
          positionId: data.positionId || null,
          managerId: data.managerId || null,
          hireDate: data.hireDate ? new Date(data.hireDate) : null,
          employmentType: data.employmentType,
          bankName: data.bankName || null,
          bankAccountNumber: data.bankAccountNumber || null,
          bankAccountName: data.bankAccountName || null,
          tin: data.tin || null,
          ssn: data.ssn || null,
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
      }

      return emp;
    });

    await auditLog({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "create",
      entity: "employee",
      entityId: employee.id,
      metadata: { employeeCode },
    });

    return apiOk({ employee }, 201);
  } catch (error) {
    console.error(error);
    return apiError("Failed to create employee", 500);
  }
}