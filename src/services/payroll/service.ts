import { db } from "@/lib/prisma";
import {
  getActivePayrollConfiguration,
  calculatePayrollEmployee,
  type PayrollResult,
} from "@/services/payroll/engine";

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

    // Guard: accounting period overlap check handled at run creation.

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

    // Delete existing lines so recalculation is idempotent
    await tx.payrollRunLine.deleteMany({ where: { runId } });

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    for (const employee of employees) {
      const salary = employee.salaryStructures[0];
      const basicPay = salary ? Number(salary.basicSalary) : 0;
      const allowances = (salary?.allowances ?? {}) as Record<string, number>;

      const result: PayrollResult = calculatePayrollEmployee({
        basicPay,
        allowances,
        taxRules: config?.taxRules,
        deductionRules: config?.deductionRules,
        contributionRules: config?.contributionRules,
        annualize: 12,
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