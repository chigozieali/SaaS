import { getApiContext, apiOk } from "@/lib/api-utils";
import { db } from "@/lib/prisma";

const coveringSelect = { id: true, firstName: true, lastName: true };

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
    },
  });

  if (!me) {
    return apiOk({ me: null, attendance: [], leaves: [], leaveTypes: [], team: [] });
  }

  const [attendance, leaves, leaveTypes, team] = await Promise.all([
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
  ]);

  return apiOk({ me, attendance, leaves, leaveTypes, team });
}