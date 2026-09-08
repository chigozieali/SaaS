import Link from "next/link";
import {
  Briefcase,
  Building2,
  CalendarCheck,
  CircleDollarSign,
  Clock4,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";
import { requireOrg } from "@/lib/access";

export const dynamic = "force-dynamic";

const IN_SEVEN_DAYS = new Date(Date.now() + 7 * 86400000);

export default async function DashboardPage() {
  const ctx = await requireOrg("dashboard.view");

  const [
    employeeCount,
    activeEmployeeCount,
    departmentCount,
    pendingLeaveCount,
    pendingLeave,
    pendingExpenses,
    revenue,
    expenses,
    overdueInvoices,
    latestRun,
    recentAudit,
  ] = await Promise.all([
    db.employee.count({ where: { organizationId: ctx.organizationId } }),
    db.employee.count({ where: { organizationId: ctx.organizationId, isActive: true } }),
    db.department.count({ where: { organizationId: ctx.organizationId } }),
    db.leave.count({
      where: { employee: { organizationId: ctx.organizationId }, status: "pending" },
    }),
    db.leave.findMany({
      where: { employee: { organizationId: ctx.organizationId }, status: "pending" },
      include: { employee: { select: { firstName: true, lastName: true } }, leaveType: true },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
    db.expense.count({ where: { organizationId: ctx.organizationId, status: "pending" } }),
    db.journalEntryLine.aggregate({
      where: {
        journalEntry: {
          is: {
            organizationId: ctx.organizationId,
            status: "posted",
          },
        },
        account: { is: { type: "revenue" } },
      },
      _sum: { credit: true },
    }),
    db.journalEntryLine.aggregate({
      where: {
        journalEntry: {
          is: { organizationId: ctx.organizationId, status: "posted" },
        },
        account: { is: { type: "expense" } },
      },
      _sum: { debit: true },
    }),
    db.invoice.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: { in: ["sent", "partial", "overdue"] },
        dueDate: { lte: IN_SEVEN_DAYS },
      },
      include: { customer: true },
      take: 5,
      orderBy: { dueDate: "asc" },
    }),
    db.payrollRun.findFirst({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      include: { period: true },
    }),
    db.auditLog.findMany({
      where: { organizationId: ctx.organizationId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const currency = ctx.organization.currency;
  const revenueTotal = Number(revenue._sum.credit ?? 0);
  const expenseTotal = Number(expenses._sum.debit ?? 0);

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
      value: formatMoney(revenueTotal, currency),
      sub: "posted revenue",
      icon: TrendingUp,
    },
    {
      title: "Expenses",
      value: formatMoney(expenseTotal, currency),
      sub: "posted expenses",
      icon: TrendingDown,
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back to {ctx.organization.name}. Here is your business at a glance.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/payroll">
                <Wallet className="h-4 w-4" /> Run payroll
              </Link>
            </Button>
            <Button asChild>
              <Link href="/accounting/invoices">
                <CircleDollarSign className="h-4 w-4" /> New invoice
              </Link>
            </Button>
          </div>
        </div>

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

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock4 className="h-4 w-4" /> Pending Approvals
              </CardTitle>
              <CardDescription>
                {pendingLeaveCount + pendingExpenses} item(s) awaiting review
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingLeave.length === 0 && pendingExpenses === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  You are all caught up.
                </p>
              ) : (
                <div className="space-y-3">
                  {pendingLeave.map((leave) => (
                    <div key={leave.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">
                          {leave.employee.firstName} {leave.employee.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {leave.leaveType.name} · {Number(leave.days)} day(s)
                        </p>
                      </div>
                      <Badge variant="warning">Pending</Badge>
                    </div>
                  ))}
                  {pendingExpenses > 0 && (
                    <Link
                      href="/accounting/expenses"
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                    >
                      <div>
                        <p className="text-sm font-medium">Expense claims</p>
                        <p className="text-xs text-muted-foreground">{pendingExpenses} pending</p>
                      </div>
                      <Badge variant="warning">Pending</Badge>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarCheck className="h-4 w-4" /> Upcoming Receivables
              </CardTitle>
              <CardDescription>Invoices due within 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              {overdueInvoices.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No invoices due soon.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overdueInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                        <TableCell>{inv.customer.name}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(Number(inv.total), currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="h-4 w-4" /> Payroll Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestRun ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Latest period</span>
                    <span className="text-sm font-medium">{latestRun.period.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={latestRun.status === "finalized" ? "success" : latestRun.status === "approved" ? "info" : "warning"}>
                      {latestRun.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Net amount</span>
                    <span className="text-sm font-medium">
                      {formatMoney(Number(latestRun.totalNet), currency)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No payroll runs yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentAudit.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No activity yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentAudit.map((log) => (
                    <div key={log.id} className="flex items-center justify-between text-sm">
                      <span className="truncate text-muted-foreground">
                        <span className="capitalize font-medium text-foreground">{log.action}</span>{" "}
                        {log.entity.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}