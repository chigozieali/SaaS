import { Building2, TrendingDown, TrendingUp, Users } from "lucide-react";
import { db } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function DashboardStats({
  organizationId,
  currency,
}: {
  organizationId: string;
  currency: string;
}) {
  const [employeeCount, activeEmployeeCount, departmentCount, revenue, expenses] =
    await Promise.all([
      db.employee.count({ where: { organizationId } }),
      db.employee.count({ where: { organizationId, isActive: true } }),
      db.department.count({ where: { organizationId } }),
      db.journalEntryLine.aggregate({
        where: {
          journalEntry: { is: { organizationId, status: "posted" } },
          account: { is: { type: "revenue" } },
        },
        _sum: { credit: true },
      }),
      db.journalEntryLine.aggregate({
        where: {
          journalEntry: { is: { organizationId, status: "posted" } },
          account: { is: { type: "expense" } },
        },
        _sum: { debit: true },
      }),
    ]);

  const stats = [
    {
      title: "Total Employees",
      value: employeeCount,
      sub: `${activeEmployeeCount} active`,
      icon: Users,
    },
    {
      title: "Departments",
      value: departmentCount,
      sub: "across the org",
      icon: Building2,
    },
    {
      title: "Revenue",
      value: formatMoney(Number(revenue._sum.credit ?? 0), currency),
      sub: "posted revenue",
      icon: TrendingUp,
    },
    {
      title: "Expenses",
      value: formatMoney(Number(expenses._sum.debit ?? 0), currency),
      sub: "posted expenses",
      icon: TrendingDown,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{s.title}</CardTitle>
            <s.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s.value}</div>
            <p className="text-xs text-muted-foreground">{s.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}