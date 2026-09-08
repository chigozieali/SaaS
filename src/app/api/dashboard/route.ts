import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-utils";
import { db } from "@/lib/prisma";

export async function GET() {
  const res = await getApiContext();
  if ("error" in res) return res.error;
  const { ctx } = res;

  try {
    const [
      employeeCount,
      activeEmployeeCount,
      departmentCount,
      pendingLeave,
      pendingExpenses,
      pendingApprovals,
      revenue,
      expenses,
      pendingInvoices,
      latestRun,
    ] = await Promise.all([
      db.employee.count({ where: { organizationId: ctx.organizationId } }),
      db.employee.count({ where: { organizationId: ctx.organizationId, isActive: true } }),
      db.department.count({ where: { organizationId: ctx.organizationId } }),
      db.leave.count({ where: { employee: { organizationId: ctx.organizationId }, status: "pending" } }),
      db.expense.count({ where: { organizationId: ctx.organizationId, status: "pending" } }),
      db.auditLog.count({ where: { organizationId: ctx.organizationId } }),
      db.journalEntryLine.aggregate({
        where: {
          journalEntry: {
            is: {
              organizationId: ctx.organizationId,
              status: "posted",
              source: { not: "payroll" },
            },
          },
          account: { is: { type: "revenue" } },
        },
        _sum: { credit: true },
      }),
      db.journalEntryLine.aggregate({
        where: {
          journalEntry: {
            is: {
              organizationId: ctx.organizationId,
              status: "posted",
              source: { not: "payroll" },
            },
          },
          account: { is: { type: "expense" } },
        },
        _sum: { debit: true },
      }),
      db.invoice.count({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ["draft", "sent", "partial", "overdue"] },
        },
      }),
      db.payrollRun.findFirst({
        where: { organizationId: ctx.organizationId },
        orderBy: { createdAt: "desc" },
        include: { period: true, lines: { take: 3 } },
      }),
    ]);

    return NextResponse.json({
      employeeCount,
      activeEmployeeCount,
      departmentCount,
      pendingLeave,
      pendingExpenses,
      pendingApprovals,
      revenue: revenue._sum.credit ?? 0,
      expenses: expenses._sum.debit ?? 0,
      pendingInvoices,
      latestRun,
    });
  } catch {
    return NextResponse.json({ message: "Failed to load dashboard" }, { status: 500 });
  }
}