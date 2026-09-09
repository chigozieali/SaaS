import Link from "next/link";
import { CalendarClock, UserRound } from "lucide-react";
import { db } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const attendanceBadge: Record<string, "success" | "destructive" | "info" | "warning"> = {
  present: "success",
  absent: "destructive",
  on_leave: "info",
  half_day: "warning",
};

export async function EmployeeDashboard({
  organizationId,
  currency,
  email,
}: {
  organizationId: string;
  currency: string;
  email: string | null | undefined;
}) {
  const me = await db.employee.findFirst({
    where: { organizationId, email: email ?? "" },
    include: {
      position: true,
      department: true,
      salaryStructures: { where: { isActive: true }, orderBy: { effectiveFrom: "desc" }, take: 1 },
    },
  });

  if (!me) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Your account is not linked to an employee record. Ask an administrator to set your
          employee email to match your login email.
        </p>
      </Card>
    );
  }

  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const tomorrow = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yearStart = new Date(`${new Date().getFullYear()}-01-01T00:00:00.000Z`);

  const [leaves, leaveTypes, attendanceToday, latestPayslip] = await Promise.all([
    db.leave.findMany({ where: { employeeId: me.id } }),
    db.leaveType.findMany({ where: { organizationId } }),
    db.attendance.findFirst({
      where: { employeeId: me.id, date: { gte: today, lt: tomorrow } },
      orderBy: { date: "desc" },
    }),
    db.payslip.findFirst({
      where: { employeeId: me.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const yearLeaves = leaves.filter((l) => l.startDate >= yearStart);
  const leaveBalance = leaveTypes.map((type) => {
    const rows = yearLeaves.filter((l) => l.leaveTypeId === type.id);
    const taken = rows
      .filter((l) => l.status === "approved")
      .reduce((sum, l) => sum + Number(l.days), 0);
    return {
      name: type.name,
      allowed: Number(type.daysAllowed),
      taken,
      remaining: Math.max(0, Number(type.daysAllowed) - taken),
    };
  });
  const totalRemaining = leaveBalance.reduce((a, b) => a + b.remaining, 0);
  const pendingApprovals = yearLeaves.filter((l) => l.status === "pending").length;

  const stats = [
    {
      title: "Attendance today",
      value: attendanceToday
        ? attendanceToday.status.replace("_", " ")
        : "not recorded",
      icon: CalendarClock,
    },
    {
      title: "Leave remaining",
      value: `${totalRemaining.toFixed(1)} days`,
      icon: null,
    },
    {
      title: "Pending requests",
      value: String(pendingApprovals),
      icon: null,
    },
    {
      title: "Latest net pay",
      value: latestPayslip ? formatMoney(Number(latestPayslip.netPay), currency) : "—",
      icon: null,
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Welcome back,</p>
            <p className="text-lg font-semibold">
              {me.firstName} {me.lastName}
            </p>
            <p className="text-xs text-muted-foreground">
              {me.position?.title ?? "Employee"}
              {me.department ? ` · ${me.department.name}` : ""}
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/hr/my-records">
              <UserRound className="h-4 w-4" /> View my records
            </Link>
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.title} className="p-4">
            <p className="text-xs text-muted-foreground">{s.title}</p>
            <p className="mt-1 text-xl font-bold">{s.value}</p>
          </Card>
        ))}
      </div>

      {leaveBalance.length > 0 && (
        <Card className="overflow-hidden p-2">
          <div className="p-2 text-sm font-semibold">Leave Balance</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 text-right font-medium">Allowed</th>
                <th className="px-2 py-2 text-right font-medium">Taken</th>
                <th className="px-2 py-2 text-right font-medium">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {leaveBalance.map((l) => (
                <tr key={l.name} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium">{l.name}</td>
                  <td className="px-2 py-2 text-right">{l.allowed}</td>
                  <td className="px-2 py-2 text-right">{l.taken.toFixed(1)}</td>
                  <td className="px-2 py-2 text-right font-semibold">{l.remaining.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {attendanceToday && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Today&apos;s attendance</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={attendanceBadge[attendanceToday.status] ?? "outline"}>
              {attendanceToday.status.replace("_", " ")}
            </Badge>
            {attendanceToday.checkIn ? (
              <span className="text-sm text-muted-foreground">
                In: {new Date(attendanceToday.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {attendanceToday.checkOut
                  ? ` · Out: ${new Date(attendanceToday.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : ""}
              </span>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  );
}