import { db } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function RecentActivityCard({ organizationId }: { organizationId: string }) {
  const recentAudit = await db.auditLog.findMany({
    where: { organizationId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {recentAudit.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
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
  );
}