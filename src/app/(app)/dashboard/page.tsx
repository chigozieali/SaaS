import Link from "next/link";
import { Suspense } from "react";
import { CircleDollarSign, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOrg } from "@/lib/access";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { PendingApprovalsCard } from "@/components/dashboard/pending-approvals";
import { UpcomingReceivablesCard } from "@/components/dashboard/receivables-card";
import { PayrollSummaryCard } from "@/components/dashboard/payroll-summary";
import { RecentActivityCard } from "@/components/dashboard/recent-activity";

export const dynamic = "force-dynamic";

function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28" />
      ))}
    </div>
  );
}

function SectionSkeleton({ className }: { className: string }) {
  return <Skeleton className={className} />;
}

export default async function DashboardPage() {
  const ctx = await requireOrg("dashboard.view");

  return (
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

      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats
          organizationId={ctx.organizationId}
          currency={ctx.organization.currency}
        />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<SectionSkeleton className="h-72" />}>
          <PendingApprovalsCard organizationId={ctx.organizationId} />
        </Suspense>
        <Suspense fallback={<SectionSkeleton className="h-72" />}>
          <UpcomingReceivablesCard
            organizationId={ctx.organizationId}
            currency={ctx.organization.currency}
          />
        </Suspense>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<SectionSkeleton className="h-44" />}>
          <PayrollSummaryCard
            organizationId={ctx.organizationId}
            currency={ctx.organization.currency}
          />
        </Suspense>
        <Suspense fallback={<SectionSkeleton className="h-44" />}>
          <RecentActivityCard organizationId={ctx.organizationId} />
        </Suspense>
      </div>
    </div>
  );
}