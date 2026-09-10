import { getApiContext, apiOk, apiError } from "@/lib/api-utils";
import { db } from "@/lib/prisma";

function toNum(v: unknown): number {
  return Number(v ?? 0);
}

function valFor(
  obj: Record<string, unknown> | null | undefined,
  needle: string,
  employer: boolean | null
): number {
  if (!obj || typeof obj !== "object") return 0;
  for (const [k, v] of Object.entries(obj)) {
    const lower = k.toLowerCase();
    if (lower.includes(needle) && (employer === null || lower.includes("employer") === employer)) {
      return toNum(v);
    }
  }
  return 0;
}

export async function GET(req: Request) {
  const res = await getApiContext("payroll.view");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");
  let runIdFilter = runId || undefined;

  const period = runId
    ? null
    : await db.payrollPeriod.findFirst({
        where: { organizationId: ctx.organizationId, status: "finalized" },
        orderBy: { endDate: "desc" },
      });

  if (!period && !runIdFilter) return apiOk({ rows: [], byTaxOffice: [], byPfa: [], totals: null });

  if (!runIdFilter && period) {
    const latestRun = await db.payrollRun.findFirst({
      where: { periodId: period.id, organizationId: ctx.organizationId },
      orderBy: { runDate: "desc" },
    });
    if (latestRun) runIdFilter = latestRun.id;
  }

  const run = await db.payrollRun.findFirst({
    where: { id: runIdFilter, organizationId: ctx.organizationId },
    include: { period: true },
  });
  if (!run) return apiError("Payroll run not found", 404);

  const lines = await db.payrollRunLine.findMany({ where: { runId: run.id } });
  const employees = await db.employee.findMany({
    where: { id: { in: lines.map((l) => l.employeeId) } },
    select: { id: true, firstName: true, lastName: true, employeeCode: true, taxOffice: true, pfaName: true, bankAccountNumber: true },
  });
  const empMap = new Map(employees.map((e) => [e.id, e]));

  const rows = lines.map((line) => {
    const emp = empMap.get(line.employeeId);
    const deductions = (line.deductions ?? {}) as Record<string, number>;
    const employerContribs = (line.employerContribJson ?? {}) as Record<string, number>;
    const taxJson = (line.taxJson ?? {}) as Record<string, number>;
    return {
      employeeId: line.employeeId,
      name: emp ? `${emp.firstName} ${emp.lastName}` : "—",
      code: emp?.employeeCode ?? "—",
      taxOffice: emp?.taxOffice ?? null,
      pfa: emp?.pfaName ?? null,
      bankAccountNumber: emp?.bankAccountNumber ?? line.bankAccountNumber,
      grossPay: toNum(line.grossPay),
      overtimePay: toNum(line.overtimePay),
      unpaidDeduction: toNum(line.unpaidDeduction),
      totalDeductions: toNum(line.totalDeductions),
      tax: valFor(taxJson, "incometax", null),
      pensionEmployee: valFor(deductions, "pension", false),
      pensionEmployer: valFor(employerContribs, "pension", true),
      nhiaEmployee: valFor(deductions, "nhia", false),
      nhiaEmployer: valFor(employerContribs, "nhia", true),
      hmoEmployee: valFor(deductions, "hmo", false),
      hmoEmployer: valFor(employerContribs, "hmo", true),
      itf: valFor(employerContribs, "itf", null),
      nsitf: valFor(employerContribs, "nsitf", null),
      netPay: toNum(line.netPay),
    };
  });

  const byTaxOffice = new Map<string, { taxOffice: string; count: number; tax: number }>();
  const byPfa = new Map<string, { pfa: string; count: number; employee: number; employer: number }>();
  const totals = { grossPay: 0, tax: 0, pensionEmployee: 0, pensionEmployer: 0, netPay: 0 };

  for (const row of rows) {
    totals.grossPay += row.grossPay;
    totals.tax += row.tax;
    totals.pensionEmployee += row.pensionEmployee;
    totals.pensionEmployer += row.pensionEmployer;
    totals.netPay += row.netPay;

    const office = row.taxOffice ?? "Unassigned";
    const off = byTaxOffice.get(office) ?? { taxOffice: office, count: 0, tax: 0 };
    off.count += 1;
    off.tax += row.tax;
    byTaxOffice.set(office, off);

    const pfa = row.pfa ?? "Unassigned";
    const p = byPfa.get(pfa) ?? { pfa, count: 0, employee: 0, employer: 0 };
    p.count += 1;
    p.employee += row.pensionEmployee;
    p.employer += row.pensionEmployer;
    byPfa.set(pfa, p);
  }

  return apiOk({
    rows,
    byTaxOffice: [...byTaxOffice.values()].map((r) => ({ ...r, tax: Math.round(r.tax * 100) / 100 })),
    byPfa: [...byPfa.values()].map((r) => ({
      ...r,
      employee: Math.round(r.employee * 100) / 100,
      employer: Math.round(r.employer * 100) / 100,
    })),
    totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, Math.round(v * 100) / 100])),
    run: { id: run.id, periodName: run.period.name, status: run.status },
  });
}