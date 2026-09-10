import { z } from "zod";
import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

export async function GET() {
  const res = await getApiContext("payroll.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const loans = await db.staffLoan.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, employeeCode: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const summary = await db.staffLoanRepayment.groupBy({
    by: ["loanId"],
    _sum: { amount: true },
    _count: { _all: true },
  });
  const summaryMap = new Map(
    summary.map((s) => [s.loanId, { totalRepaid: s._sum.amount ?? 0, repayments: s._count._all }])
  );

  return apiOk({
    loans: loans.map((loan) => ({
      ...loan,
      totalRepaid: summaryMap.get(loan.id)?.totalRepaid ?? 0,
      repaymentCount: summaryMap.get(loan.id)?.repayments ?? 0,
    })),
    employees: await db.employee.findMany({
      where: { organizationId: ctx.organizationId, isActive: true },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
      orderBy: { firstName: "asc" },
    }),
  });
}

const loanSchema = z.object({
  employeeId: z.string().min(1),
  amount: z.number().positive(),
  durationMonths: z.number().int().min(1).default(1),
  monthlyDeduction: z.number().positive().optional(),
  interestRate: z.number().min(0).optional(),
  purpose: z.string().optional(),
});

export async function POST(req: Request) {
  const res = await getApiContext("payroll.configure");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const body = await req.json().catch(() => null);
  const parsed = loanSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input");

  const employee = await db.employee.findFirst({
    where: { id: parsed.data.employeeId, organizationId: ctx.organizationId },
  });
  if (!employee) return apiError("Employee not found", 404);

  const amount = Math.round(parsed.data.amount * 100) / 100;
  const monthlyDeduction = parsed.data.monthlyDeduction
    ? Math.round(parsed.data.monthlyDeduction * 100) / 100
    : Math.round((amount / parsed.data.durationMonths) * 100) / 100;

  const loan = await db.staffLoan.create({
    data: {
      organizationId: ctx.organizationId,
      employeeId: parsed.data.employeeId,
      amount,
      monthlyDeduction,
      durationMonths: parsed.data.durationMonths,
      interestRate: parsed.data.interestRate ?? null,
      purpose: parsed.data.purpose ?? null,
      status: "pending",
    },
  });

  await auditLog({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    action: "create_loan",
    entity: "staff_loan",
    entityId: loan.id,
    metadata: { amount, employeeId: parsed.data.employeeId },
  });

  return apiOk({ loan }, 201);
}