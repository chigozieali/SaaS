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
      manager: { select: { id: true, firstName: true, lastName: true } },
      salaryStructures: { where: { isActive: true }, orderBy: { effectiveFrom: "desc" }, take: 1 },
    },
  });

  const [org] = await db.organization.findMany({
    where: { id: ctx.organizationId },
    select: { currency: true },
    take: 1,
  });
  const currency = org?.currency ?? "NGN";

  if (!me) {
    return apiOk({ me: null, attendance: [], leaves: [], leaveTypes: [], team: [], leaveBalance: [], payslips: [], salary: null, currency });
  }

  const [ownAttendance, leaves, leaveTypes, team, payslips] = await Promise.all([
    db.attendance.findMany({
      where: { employeeId: me.id },
      orderBy: { date: "desc" },
      take: 60,
    }),
    db.leave.findMany({
      where: { employeeId: me.id },
      include: { leaveType: true, coveringFor: { select: coveringSelect } },
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

  // Leave balance per type (calendar year).
  const yearLeaves = leaves.filter((l) => l.startDate >= yearStart);
  const leaveBalance = leaveTypes.map((type) => {
    const rows = yearLeaves.filter((l) => l.leaveTypeId === type.id);
    const taken = rows
      .filter((l) => l.status === "approved")
      .reduce((sum, l) => sum + Number(l.days), 0);
    const pending = rows
      .filter((l) => l.status === "pending")
      .reduce((sum, l) => sum + Number(l.days), 0);
    return {
      leaveTypeId: type.id,
      name: type.name,
      allowed: Number(type.daysAllowed),
      taken,
      pending,
      remaining: Math.max(0, Number(type.daysAllowed) - taken),
    };
  });

  const salary = me.salaryStructures[0]
    ? {
        id: me.salaryStructures[0].id,
        basicSalary: Number(me.salaryStructures[0].basicSalary),
        allowances: me.salaryStructures[0].allowances as Record<string, number>,
      }
    : null;

  return apiOk({
    me,
    attendance,
    leaves,
    leaveTypes,
    team,
    leaveBalance,
    payslips,
    salary,
    currency,
  });
}