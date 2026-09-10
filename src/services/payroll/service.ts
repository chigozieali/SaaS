import { db } from "@/lib/prisma";
import {
  getActivePayrollConfiguration,
  calculatePayrollEmployee,
  type PayrollResult,
} from "@/services/payroll/engine";

/** Calendar-day overlap between [lStart,lEnd] and [pStart,pEnd]. */
function overlapDays(lStart: Date, lEnd: Date, pStart: Date, pEnd: Date): number {
  const start = new Date(Math.max(lStart.getTime(), pStart.getTime()));
  const end = new Date(Math.min(lEnd.getTime(), pEnd.getTime()));
  if (start > end) return 0;
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

type AdjustmentContext = {
  overtimeHours: number;
  absentDays: number;
  unpaidLeaveDays: number;
  extraDeductions: Array<{ name: string; amount: number }>;
  extraContributions: Array<{ name: string; amount: number }>;
  deductionOverrides: Record<string, number>;
};

/**
 * Gather the pay-impacting signals HR produces for an employee for a period:
 * overtime hours, unpaid absences, approved unpaid leave, benefit (HMO)
 * enrollment shares, and per-employee pension/NHIA percentage overrides.
 */
async function collectAdjustments(
  tx: import("@prisma/client").Prisma.TransactionClient,
  employeeId: string,
  grossBase: number,
  workingDays: number,
  periodStart: Date,
  periodEnd: Date,
  runId?: string
): Promise<AdjustmentContext> {
  const ctx: AdjustmentContext = {
    overtimeHours: 0,
    absentDays: 0,
    unpaidLeaveDays: 0,
    extraDeductions: [],
    extraContributions: [],
    deductionOverrides: {},
  };
  if (!workingDays) return ctx;

  const [attendanceRows, leaves, enrollments, emp, loans, payrollClaims] = await Promise.all([
    tx.attendance.findMany({ where: { employeeId, date: { gte: periodStart, lte: periodEnd } } }),
    tx.leave.findMany({
      where: {
        employeeId,
        status: "approved",
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      include: { leaveType: true },
    }),
    tx.employeeBenefit.findMany({
      where: { employeeId, isActive: true },
      include: { plan: true },
    }),
    tx.employee.findUnique({ where: { id: employeeId } }),
    tx.staffLoan.findMany({
      where: { employeeId, status: "active", outstandingBalance: { gt: 0 } },
    }),
    runId
      ? tx.expense.findMany({
          where: { employeeId, status: "approved", reimbursementMethod: "payroll", payrollRunId: runId, paidAt: null },
        })
      : Promise.resolve([]),
  ]);

  for (const row of attendanceRows) {
    ctx.overtimeHours += Number(row.overtimeHours ?? 0);
    if (row.status === "absent") ctx.absentDays += 1;
  }
  for (const leave of leaves) {
    if (!leave.leaveType.isPaid) {
      ctx.unpaidLeaveDays += overlapDays(leave.startDate, leave.endDate, periodStart, periodEnd);
    }
  }

  // HMO / benefit plan shares (plan shares are treated as monthly amounts).
  for (const enrollment of enrollments) {
    if (enrollment.plan.type !== "hmo") continue;
    const premium = Number(enrollment.plan.premium ?? 0);
    const empSharePct = Number(enrollment.plan.employeeSharePct ?? 0) / 100;
    const empSharePct2 = Number(enrollment.plan.employerSharePct ?? 0) / 100;
    const employeeShare =
      enrollment.employeeContribution != null
        ? Number(enrollment.employeeContribution)
        : premium * empSharePct;
    const employerShare = premium * empSharePct2;
    if (employeeShare > 0) ctx.extraDeductions.push({ name: `${enrollment.plan.name}`, amount: employeeShare });
    if (employerShare > 0) ctx.extraContributions.push({ name: `${enrollment.plan.name} (Employer)`, amount: employerShare });
  }

  // Per-employee pension / NHIA % act as overrides on matching configured rules.
  if (emp?.pensionPct != null) {
    ctx.deductionOverrides["pension"] = Math.round((grossBase * Number(emp.pensionPct)) / 100 * 100) / 100;
  }
  if (emp?.nhiaPct != null) {
    ctx.deductionOverrides["nhia"] = Math.round((grossBase * Number(emp.nhiaPct)) / 100 * 100) / 100;
  }

  // Active staff loans: monthly repayment recovered from gross/net pay.
  const loanRepayment = loans.reduce((s, loan) => {
    const scheduled = Number(loan.monthlyDeduction ?? 0);
    return s + Math.min(scheduled, Number(loan.outstandingBalance));
  }, 0);
  if (loanRepayment > 0) {
    ctx.extraDeductions.push({ name: "Loan Repayment", amount: Math.round(loanRepayment * 100) / 100 });
  }

  // Approved expense claims paid through this payroll run: net pay top-up
  // (negative deduction) that simultaneously clears the reimbursement payable.
  const claimsTotal = payrollClaims.reduce((s, c) => s + Number(c.amount), 0);
  if (claimsTotal > 0) {
    ctx.extraDeductions.push({ name: "Expense Reimbursement", amount: -Math.round(claimsTotal * 100) / 100 });
  }

  return ctx;
}

/**
 * Compute all payroll lines for a run within a transaction.
 * The run must be in draft/submitted state (finalized runs cannot be re-calculated).
 */
export async function computePayrollRun(runId: string, organizationId: string) {
  return db.$transaction(async (tx) => {
    const run = await tx.payrollRun.findFirst({
      where: { id: runId, organizationId },
    });
    if (!run) throw new Error("Payroll run not found");
    if (["approved", "finalized", "posted"].includes(run.status)) {
      throw new Error("Finalized/approved payroll cannot be re-calculated");
    }

    const period = await tx.payrollPeriod.findUnique({ where: { id: run.periodId } });
    if (!period) throw new Error("Payroll period not found");

    const employees = await tx.employee.findMany({
      where: {
        organizationId,
        isActive: true,
        status: { not: "terminated" },
      },
      include: {
        salaryStructures: {
          where: { isActive: true },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
        department: true,
      },
    });

    // Organization currency + country for config
    const org = await tx.organization.findUnique({ where: { id: organizationId } });

    const config = org
      ? await getActivePayrollConfiguration(organizationId, org.countryCode, period.endDate)
      : null;
    const workingDays = Number(config?.workingDaysPerMonth) || 22;

    // Delete existing lines so recalculation is idempotent
    await tx.payrollRunLine.deleteMany({ where: { runId } });

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    for (const employee of employees) {
      const salary = employee.salaryStructures[0];
      const basicPay = salary ? Number(salary.basicSalary) : 0;
      const allowances = (salary?.allowances ?? {}) as Record<string, number>;
      const grossBase = basicPay + Object.values(allowances).reduce((a, b) => a + b, 0);

      const adjustments = await collectAdjustments(
        tx,
        employee.id,
        grossBase,
        workingDays,
        period.startDate,
        period.endDate,
        runId
      );

      const overtimePay =
        Math.round(
          ctxOvertimePay(adjustments, grossBase, workingDays, config?.overtimeFactor ?? 1) * 100
        ) / 100;

      const unpaidDeduction = Math.round(
        ((adjustments.absentDays + adjustments.unpaidLeaveDays) * grossBase) / workingDays * 100
      ) / 100;

      const result: PayrollResult = calculatePayrollEmployee({
        basicPay,
        allowances,
        taxRules: config?.taxRules,
        deductionRules: config?.deductionRules,
        contributionRules: config?.contributionRules,
        annualize: 12,
        overtimePay,
        unpaidDeduction,
        extraDeductions: adjustments.extraDeductions,
        extraContributions: adjustments.extraContributions,
        deductionOverrides: adjustments.deductionOverrides,
      });

      await tx.payrollRunLine.create({
        data: {
          runId,
          employeeId: employee.id,
          basicPay: basicPay,
          allowances: allowances as never,
          grossPay: result.grossPay,
          totalAllowances:
            Math.round(Object.values(allowances).reduce((a, b) => a + b, 0) * 100) / 100,
          deductions: result.deductionBreakdown as never,
          totalDeductions: result.totalDeductions,
          totalContributions: result.totalContributions,
          overtimePay: result.overtimePay,
          unpaidDeduction: result.unpaidDeduction,
          netPay: result.netPay,
          employerContribJson: result.contributionBreakdown as never,
          taxJson: result.taxBreakdown as never,
          bankAccountNumber: employee.bankAccountNumber ?? null,
          status: "calculated",
        },
      });

      totalGross += result.grossPay;
      totalDeductions += result.totalDeductions;
      totalNet += result.netPay;
    }

    await tx.payrollRun.update({
      where: { id: runId },
      data: {
        totalGross: Math.round(totalGross * 100) / 100,
        totalDeductions: Math.round(totalDeductions * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100,
      },
    });

    return {
      runId,
      employeeCount: employees.length,
      totalGross,
      totalDeductions,
      totalNet,
    };
  }, { timeout: 120_000 });
}

function ctxOvertimePay(
  adjustments: AdjustmentContext,
  grossBase: number,
  workingDays: number,
  factor: number
): number {
  if (!adjustments.overtimeHours) return 0;
  const dailyRate = grossBase / workingDays;
  const hourlyRate = dailyRate / 8;
  return adjustments.overtimeHours * hourlyRate * factor;
}

export async function finalizePayrollRun(runId: string, organizationId: string, userId: string) {
  return db.$transaction(async (tx) => {
    const run = await tx.payrollRun.findFirst({ where: { id: runId, organizationId } });
    if (!run) throw new Error("Payroll run not found");
    if (run.status !== "approved") {
      throw new Error("Run must be approved before finalizing");
    }

    const updated = await tx.payrollRun.update({
      where: { id: runId },
      data: { status: "finalized", finalizedAt: new Date(), finalizedById: userId },
    });

    // Generate payslips for all lines
    const lines = await tx.payrollRunLine.findMany({ where: { runId } });
    const period = await tx.payrollPeriod.findUnique({ where: { id: run.periodId } });

    for (const line of lines) {
      await tx.payslip.upsert({
        where: { runLineId: line.id },
        update: {},
        create: {
          runLineId: line.id,
          employeeId: line.employeeId,
          organizationId,
          periodName: period?.name ?? run.periodId,
          grossPay: line.grossPay,
          totalDeductions: line.totalDeductions,
          netPay: line.netPay,
          breakdown: {
            basicPay: Number(line.basicPay),
            allowances: line.allowances,
            deductions: line.deductions,
            contributions: line.employerContribJson,
            tax: line.taxJson,
            overtimePay: Number(line.overtimePay),
            unpaidDeduction: Number(line.unpaidDeduction),
          } as never,
          issuedAt: new Date(),
        },
      });
    }

    await tx.payrollPeriod.update({
      where: { id: run.periodId },
      data: { status: "finalized" },
    });

    return updated;
  }, { timeout: 120_000 });
}