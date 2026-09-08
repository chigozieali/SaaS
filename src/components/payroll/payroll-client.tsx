"use client";

import useSWR from "swr";
import { useState } from "react";
import { CalendarPlus, RefreshCw, Send, CheckCheck, Lock, BookOpenCheck } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const badgeVariant: Record<string, "warning" | "success" | "destructive" | "info" | "outline"> = {
  draft: "outline",
  submitted: "info",
  approved: "warning",
  finalized: "success",
  posted: "success",
};

const flow: Record<string, string[]> = {
  draft: ["submit"],
  submitted: ["approve"],
  approved: ["finalize"],
  finalized: ["post"],
  posted: [],
};

type PayrollRunRow = {
  id: string;
  status: string;
  _count: { lines: number };
  lines: { netPay: number }[];
  period: { name: string; startDate: string; endDate: string };
};

type PayrollPeriodRow = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  payDate: string | null;
  status: string;
  _count: { runs: number };
};

export function PayrollClient() {
  const { data, mutate, isLoading } = useSWR("/api/payroll/runs", fetcher);
  const { data: periodsData, mutate: mutatePeriods } = useSWR("/api/payroll/periods", fetcher);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const runs = data?.runs ?? [];
  const periods = periodsData?.periods ?? [];

  async function createPeriod(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      payDate: (formData.get("payDate") as string) || undefined,
    };
    setSaving(true);
    const res = await fetch("/api/payroll/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Payroll period created with draft run");
      mutatePeriods();
      mutate();
      setPeriodOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to create period");
    }
  }

  async function compute(runId: string) {
    setBusyId(runId);
    const res = await fetch("/api/payroll/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
    });
    setBusyId(null);
    if (res.ok) {
      toast.success("Payroll calculated");
      mutate();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Payroll calculation failed");
    }
  }

  async function act(runId: string, action: string) {
    setBusyId(runId);
    const res = await fetch(`/api/payroll/runs/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (res.ok) {
      toast.success(`Run ${action}`);
      mutate();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Operation failed");
    }
  }

  const actions: Record<string, { label: string; icon: React.ReactNode; action: string; variant?: "default" | "outline" }> = {
    submit: { label: "Submit", icon: <Send className="h-4 w-4" />, action: "submit" },
    approve: { label: "Approve", icon: <CheckCheck className="h-4 w-4" />, action: "approve" },
    finalize: { label: "Finalize", icon: <Lock className="h-4 w-4" />, action: "finalize" },
    post: { label: "Post to GL", icon: <BookOpenCheck className="h-4 w-4" />, action: "post", variant: "outline" },
  };

  const runColumns: ColumnDef<PayrollRunRow>[] = [
    {
      accessorFn: (run) => run.period.name,
      id: "period",
      header: "Period",
      cell: ({ row }) => <span className="font-medium">{row.original.period.name}</span>,
    },
    {
      accessorFn: (run) => new Date(run.period.startDate).getTime(),
      id: "dateRange",
      header: "Date range",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {new Date(row.original.period.startDate).toLocaleDateString()} –{" "}
          {new Date(row.original.period.endDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      accessorFn: (run) => run._count.lines,
      id: "employees",
      header: "Employees",
    },
    {
      accessorFn: (run) =>
        run.lines.length > 0 && !run.lines.some((l) => Number(l.netPay) === 0)
          ? run.lines.reduce((s, l) => s + Number(l.netPay), 0)
          : 0,
      id: "netPay",
      header: "Net pay",
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => {
        const { lines } = row.original;
        return lines.length > 0 && !lines.some((l) => Number(l.netPay) === 0)
          ? lines.reduce((s, l) => s + Number(l.netPay), 0).toLocaleString()
          : "—";
      },
    },
    {
      accessorFn: (run) => run.status,
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={badgeVariant[row.original.status] ?? "outline"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => {
        const run = row.original;
        return (
          <div className="flex justify-end gap-1">
            {run.status === "draft" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={busyId === run.id}
                onClick={() => compute(run.id)}
              >
                <RefreshCw className={`h-3 w-3 ${busyId === run.id ? "animate-spin" : ""}`} />
                Calculate
              </Button>
            )}
            {(flow[run.status] ?? []).map((action) => {
              const a = actions[action];
              return (
                <Button
                  key={action}
                  size="sm"
                  variant={a.variant ?? "default"}
                  className="h-7"
                  disabled={busyId === run.id}
                  onClick={() => act(run.id, action)}
                >
                  {a.icon} {busyId === run.id && action === run.status ? "…" : a.label}
                </Button>
              );
            })}
          </div>
        );
      },
    },
  ];

  const periodColumns: ColumnDef<PayrollPeriodRow>[] = [
    {
      accessorFn: (p) => p.name,
      id: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorFn: (p) => new Date(p.startDate).getTime(),
      id: "start",
      header: "Start",
      cell: ({ row }) => <span>{new Date(row.original.startDate).toLocaleDateString()}</span>,
    },
    {
      accessorFn: (p) => new Date(p.endDate).getTime(),
      id: "end",
      header: "End",
      cell: ({ row }) => <span>{new Date(row.original.endDate).toLocaleDateString()}</span>,
    },
    {
      accessorFn: (p) => (p.payDate ? new Date(p.payDate).getTime() : null),
      id: "payDate",
      header: "Pay date",
      cell: ({ row }) =>
        row.original.payDate ? (
          <span>{new Date(row.original.payDate).toLocaleDateString()}</span>
        ) : (
          <span>—</span>
        ),
    },
    {
      accessorFn: (p) => p.status,
      id: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant="secondary">{row.original.status}</Badge>,
    },
    {
      accessorFn: (p) => p._count.runs,
      id: "runs",
      header: "Runs",
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => <span>{row.original._count.runs}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Payroll" description="Run, review and approve payroll cycles.">
        <Button onClick={() => setPeriodOpen(true)}>
          <CalendarPlus className="h-4 w-4" /> New Period
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          title="No payroll runs"
          description="Create a payroll period to get started. A draft run is created automatically."
          action={
            <Button onClick={() => setPeriodOpen(true)}>
              <CalendarPlus className="h-4 w-4" /> New Period
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={runColumns}
            data={runs as PayrollRunRow[]}
            filterKeys={["period.name", "status"]}
            searchPlaceholder="Search payroll runs…"
            emptyMessage="No payroll runs match your search"
            pageSize={10}
          />
        </Card>
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold">Payroll periods</h2>
      <Card className="overflow-hidden p-2">
        <DataTable
          columns={periodColumns}
          data={periods as PayrollPeriodRow[]}
          filterKeys={["name", "status"]}
          searchPlaceholder="Search periods…"
          emptyMessage="No periods yet."
          pageSize={10}
        />
      </Card>

      <Dialog open={periodOpen} onOpenChange={setPeriodOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Payroll Period</DialogTitle>
            <DialogDescription>A draft payroll run is created automatically.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createPeriod} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Period name</Label>
              <Input id="name" name="name" placeholder="January 2026" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input id="startDate" name="startDate" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End date</Label>
                <Input id="endDate" name="endDate" type="date" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payDate">Pay date (optional)</Label>
              <Input id="payDate" name="payDate" type="date" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPeriodOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create period"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}