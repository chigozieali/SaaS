import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function GET() {
  const res = await getApiContext("accounting.expenses");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const [expenses, categories] = await Promise.all([
    db.expense.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        category: true,
        vendor: true,
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
        payrollRun: { include: { period: true } },
      },
      orderBy: { date: "desc" },
    }),
    db.expenseCategory.findMany({ where: { organizationId: ctx.organizationId } }),
  ]);
  return apiOk({ expenses, categories });
}

const expenseSchema = z.object({
  categoryId: z.string().optional().nullable(),
  amount: z.number().positive(),
  date: z.string().min(1),
  description: z.string().optional(),
  vendorId: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
  reimbursementMethod: z.enum(["payroll", "bank"]).optional().nullable(),
  receiptUrl: z.string().url().optional().nullable(),
});

export async function POST(req: Request) {
  const res = await getApiContext("accounting.expenses");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const isEmployeeClaim = Boolean(parsed.data.employeeId);
  if (isEmployeeClaim) {
    const employee = await db.employee.findFirst({
      where: { id: parsed.data.employeeId!, organizationId: ctx.organizationId },
    });
    if (!employee) return apiError("Employee not found", 404);
  }

  const expense = await db.expense.create({
    data: {
      organizationId: ctx.organizationId,
      categoryId: parsed.data.categoryId || null,
      amount: parsed.data.amount,
      date: new Date(parsed.data.date),
      description: parsed.data.description || null,
      vendorId: parsed.data.vendorId || null,
      employeeId: parsed.data.employeeId || null,
      reimbursementMethod: isEmployeeClaim
        ? (parsed.data.reimbursementMethod ?? "bank")
        : null,
      receiptUrl: parsed.data.receiptUrl || null,
      status: "pending",
      createdById: ctx.userId,
    },
  });
  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "create",
    entity: "expense",
    entityId: expense.id,
    metadata: { employeeId: expense.employeeId },
  });
  return apiOk({ expense }, 201);
}

const categorySchema = z.object({ name: z.string().min(1), accountId: z.string().optional() });

export async function PATCH(req: Request) {
  const res = await getApiContext("accounting.expenses");
  if ("error" in res) return res.error;
  const { ctx } = res;
  const body = await req.json().catch(() => null);
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid input");

  const category = await db.expenseCategory.create({
    data: { organizationId: ctx.organizationId, name: parsed.data.name, accountId: parsed.data.accountId || null },
  });
  return apiOk({ category }, 201);
}