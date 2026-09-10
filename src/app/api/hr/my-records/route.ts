import { getApiContext, apiOk } from "@/lib/api-utils";
import { db } from "@/lib/prisma";

const coveringSelect = { id: true, firstName: true, lastName: true };

const yearStart = new Date(`${new Date().getFullYear()}-01-01T00:00:00.000Z`);

function inRange(row: { date: Date }, start: Date, end: Date) {
  const d = new Date(row.date.toISOString().slice(0, 10));
  return d >= start && d <= end;
}

export async function GET() {
  const res = await getApiContext("employees.self");
  if ("error" in res) return res.error;
  const { ctx } = res;

  const me = await db.employee.findFirst({
    where: { organizationId: ctx.organizationId, email: ctx.user.email ?? "" },
    include: {
      department: true,
      position: true,
      salaryGrade: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
      salaryStructures: { where: { isActive: true }, orderBy: { effectiveFrom: "desc" }, take: 1 },
      benefitEnrollments: { where: { isActive: true }, include: { plan: true } },
      documents: { orderBy: { createdAt: "desc" }, take: 20 },
      acknowledgements: { orderBy: { acknowledgedAt: "desc" }, take: 20 },
    },
  });

  const [org] = await db.organization.findMany({
    where: { id: ctx.organizationId },
    select: { currency: true },
    take: 1,
  });
  const currency = org?.currency ?? "NGN";

  if (!me) {
    return apiOk({ me: null, attendance: [], leaves: [], leaveTypes: [], team: [], leaveBalance: [], payslips: [], salary: null, benefits: [], documents: [], ytdDeductions: [], overtimeByMonth: [], currency });
  }

  const [ownAttendance, leaves, leaveTypes, team, payslips] = await Promise.all([
    db.attendance.findMany({
      where: { employeeId: me.id },
      orderBy: { date: "desc" },
      take: 60,
    }),
    db.leave.findMany({
      where: { employeeId: me.id },
      include: {
        leaveType: true,
        coveringFor: { select: coveringSelect },
      },
      orderBy: { startDate: "desc" },
    }),
    db.leaveType.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { name: "asc" },
    }),
    me.departmentId
      ? db.employee.findMany({
          where: { organizationId: ctx.organizationId, departmentId: me.departmentId, isActive: true },
          include: {
            position: true,
            manager: { select: { id: true, firstName: true, lastName: true } },
            leaves: {
              where: { status: "approved" },
              include: { coveringFor: { select: coveringSelect } },
              orderBy: { startDate: "desc" },
            },
          },
          orderBy: { firstName: "asc" },
        })
      : Promise.resolve([]),
    db.payslip.findMany({
      where: { employeeId: me.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  // Approver names for leave rows (Leave uses approvedById without a relation).
  const approverIds = [...new Set(leaves.map((l) => l.approvedById).filter(Boolean))] as string[];
  const approvers = approverIds.length
    ? await db.employee.findMany({
        where: { id: { in: approverIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const approverOf = new Map(approvers.map((e) => [e.id, `${e.firstName} ${e.lastName}`.trim()]));
  const leavesApi = leaves.map((l) => ({
    ...l,
    days: Number(l.days),
    approvedBy: l.approvedById ? { id: l.approvedById, name: approverOf.get(l.approvedById) ?? "—" } : null,
  }));

  // Covering colleagues' attendance while they covered for me.
  const coveringAttendance: Array<{
    id: string;
    date: Date;
    checkIn: Date | null;
    checkOut: Date | null;
    hoursWorked: number | null;
    status: string;
    employee: { firstName: string; lastName: string };
  }> = [];
  const seenCovering = new Set<string>();
  for (const leave of leaves) {
    if (leave.status !== "approved" || !leave.coveringForId) continue;
    const key = `${leave.coveringForId}|${leave.startDate.toISOString().slice(0, 10)}`;
    if (seenCovering.has(key)) continue;
    seenCovering.add(key);
    const coveringRows = await db.attendance.findMany({
      where: { employeeId: leave.coveringForId, status: "present" },
      orderBy: { date: "asc" },
    });
    for (const row of coveringRows) {
      if (inRange(row, leave.startDate, leave.endDate)) {
        coveringAttendance.push({
          id: `${row.id}-cov`,
          date: row.date,
          checkIn: row.checkIn,
          checkOut: row.checkOut,
          hoursWorked: row.hoursWorked ? Number(row.hoursWorked) : null,
          status: row.status,
          employee: {
            firstName: leave.coveringFor?.firstName ?? "",
            lastName: leave.coveringFor?.lastName ?? "",
          },
        });
      }
    }
  }

  const attendance = [
    ...ownAttendance.map((a) => ({
      id: a.id,
      date: a.date.toISOString(),
      checkIn: a.checkIn?.toISOString() ?? null,
      checkOut: a.checkOut?.toISOString() ?? null,
      hoursWorked: a.hoursWorked ? Number(a.hoursWorked) : null,
      status: a.status,
      employee: null as { firstName: string; lastName: string } | null,
    })),
    ...coveringAttendance.map((a) => ({
      id: a.id,
      date: a.date.toISOString(),
      checkIn: a.checkIn?.toISOString() ?? null,
      checkOut: a.checkOut?.toISOString() ?? null,
      hoursWorked: a.hoursWorked,
      status: a.status,
      employee: a.employee,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 60);

  // Leave balance per type: annual entitlement (or accrual), plus capped
  // carryover from the previous year, minus approved days taken this year.
  const yearLeaves = leaves.filter((l) => l.startDate >= yearStart);
  const lastYearStart = new Date(`${new Date().getFullYear() - 1}-01-01T00:00:00.000Z`);
  const priorYearLeaves = leaves.filter(
    (l) => l.status === "approved" && l.startDate >= lastYearStart && l.startDate < yearStart
  );
  const yearsSinceHire = me.hireDate
    ? Math.max(0, Math.min(12, ((yearStart.getTime() - new Date(me.hireDate.toISOString().slice(0, 10)).getTime()) / (1000 * 60 * 60 * 24 * 30.44))))
    : 12;
  const leaveBalance = leaveTypes.map((type) => {
    const rows = yearLeaves.filter((l) => l.leaveTypeId === type.id);
    const taken = rows
      .filter((l) => l.status === "approved")
      .reduce((sum, l) => sum + Number(l.days), 0);
    const pending = rows
      .filter((l) => l.status === "pending")
      .reduce((sum, l) => sum + Number(l.days), 0);
    const annual = Number(type.daysAllowed);
    const accrual = type.accrualPerMonth ? Math.round(Number(type.accrualPerMonth) * yearsSinceHire * 10) / 10 : null;
    const base = accrual !== null ? Math.min(accrual, annual) : annual;
    const priorUsed = priorYearLeaves
      .filter((l) => l.leaveTypeId === type.id)
      .reduce((sum, l) => sum + Number(l.days), 0);
    const unusedPrior = Math.max(0, annual - priorUsed);
    const carryover = Math.min(unusedPrior, Number(type.carryoverMax ?? 0));
    const available = base + carryover;
    return {
      leaveTypeId: type.id,
      name: type.name,
      isPaid: type.isPaid,
      allowed: Math.round(available * 10) / 10,
      taken,
      pending,
      carryover: Math.round(carryover * 10) / 10,
      remaining: Math.max(0, Math.round((available - taken) * 10) / 10),
    };
  });

  // Payroll section: YTD deductions from the current year's payslips.
  const yearPayslips = payslips.filter((p) => p.createdAt >= yearStart);
  const ytdDeductions: Array<{ name: string; amount: number }> = [];
  const ytdMap = new Map<string, number>();
  for (const p of yearPayslips) {
    const breakdown = (p.breakdown ?? {}) as Record<string, unknown>;
    const deductions = (breakdown.deductions ?? {}) as Record<string, number>;
    for (const [k, v] of Object.entries(deductions)) {
      ytdMap.set(k, (ytdMap.get(k) ?? 0) + Number(v ?? 0));
    }
  }
  for (const [name, amount] of ytdMap) {
    ytdDeductions.push({ name, amount: Math.round(amount * 100) / 100 });
  }

  // Monthly overtime summary for the current year / recent months.
  const overtimeByMonth: Array<{ month: string; hours: number }> = [];
  const otMap = new Map<string, number>();
  for (const a of ownAttendance) {
    if (a.date < yearStart) continue;
    const key = a.date.toISOString().slice(0, 7);
    otMap.set(key, (otMap.get(key) ?? 0) + Number(a.overtimeHours ?? 0));
  }
  for (const [month, hours] of otMap) {
    overtimeByMonth.push({ month, hours: Math.round(hours * 100) / 100 });
  }
  overtimeByMonth.sort((a, b) => b.month.localeCompare(a.month));

  const salary = me.salaryStructures[0]
    ? {
        id: me.salaryStructures[0].id,
        basicSalary: Number(me.salaryStructures[0].basicSalary),
        allowances: me.salaryStructures[0].allowances as Record<string, number>,
        payFrequency: me.payFrequency,
      }
    : null;

  // Expected payday: latest finalized period's pay date, projected forward one pay cycle.
  const latestPeriod = await db.payrollPeriod.findFirst({
    where: { organizationId: ctx.organizationId, status: "finalized", payDate: { not: null } },
    orderBy: { endDate: "desc" },
    select: { payDate: true },
  });
  const freqMonths = me.payFrequency === "weekly" ? 0 : me.payFrequency === "biweekly" ? 0 : 1;
  let payday: { frequency: string; lastPayDate: string | null; nextPayDate: string | null } = {
    frequency: me.payFrequency ?? "monthly",
    lastPayDate: null,
    nextPayDate: null,
  };
  if (latestPeriod?.payDate) {
    const lastPayDate = new Date(latestPeriod.payDate.toISOString());
    const nextPayDate = new Date(lastPayDate);
    if (freqMonths > 0) {
      nextPayDate.setMonth(nextPayDate.getMonth() + 1);
    } else {
      nextPayDate.setDate(nextPayDate.getDate() + 14);
    }
    while (nextPayDate.getTime() <= Date.now()) {
      if (freqMonths > 0) nextPayDate.setMonth(nextPayDate.getMonth() + 1);
      else nextPayDate.setDate(nextPayDate.getDate() + 14);
    }
    payday = {
      frequency: me.payFrequency ?? "monthly",
      lastPayDate: lastPayDate.toISOString().slice(0, 10),
      nextPayDate: nextPayDate.toISOString().slice(0, 10),
    };
  }

  return apiOk({
    me,
    attendance,
    leaves: leavesApi,
    leaveTypes,
    team,
    leaveBalance,
    payslips,
    salary,
    benefits: me.benefitEnrollments,
    documents: me.documents,
    ytdDeductions,
    overtimeByMonth,
    payday,
    currency,
  });
}