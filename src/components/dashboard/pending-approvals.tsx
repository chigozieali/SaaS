import Link from "next/link";
import { Clock4 } from "lucide-react";
import { db } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export async function PendingApprovalsCard({ organizationId }: { organizationId: string }) {
  const [pendingLeave, pendingExpenses] = await Promise.all([
    db.leave.findMany({
      where: { employee: { organizationId }, status: "pending" },
      include: { employee: { select: { firstName: true, lastName: true } }, leaveType: true },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
    db.expense.count({ where: { organizationId, status: "pending" } }),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock4 className="h-4 w-4" /> Pending Approvals
        </CardTitle>
        <CardDescription>{pendingLeave.length + pendingExpenses} item(s) awaiting review</CardDescription>
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
  );
}