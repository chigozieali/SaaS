import { Briefcase } from "lucide-react";
import { db } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function PayrollSummaryCard({
  organizationId,
  currency,
}: {
  organizationId: string;
  currency: string;
}) {
  const latestRun = await db.payrollRun.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: { period: true },
  });

  return (
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
              <Badge
                variant={
                  latestRun.status === "finalized"
                    ? "success"
                    : latestRun.status === "approved"
                      ? "info"
                      : "warning"
                }
              >
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
          <p className="py-6 text-center text-sm text-muted-foreground">No payroll runs yet.</p>
        )}
      </CardContent>
    </Card>
  );
}