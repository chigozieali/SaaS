"use client";

import useSWR from "swr";
import { useState } from "react";
import { CalendarPlus, RefreshCw, Send, CheckCheck, Lock, BookOpenCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Date range</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead className="text-right">Net pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run: Record<string, any>) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium">{run.period.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(run.period.startDate).toLocaleDateString()} – {new Date(run.period.endDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{run._count.lines}</TableCell>
                  <TableCell className="text-right">
                    {run.lines.length > 0 && !run.lines.some((l: any) => l.netPay === 0)
                      ? `${run.lines.reduce((s: number, l: any) => s + Number(l.netPay), 0).toLocaleString()}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant[run.status] ?? "outline"}>{run.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {run.status === "draft" && (
                        <Button size="sm" variant="outline" className="h-7" disabled={busyId === run.id} onClick={() => compute(run.id)}>
                          {busyId === run.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold">Payroll periods</h2>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Pay date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Runs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No periods yet.
                </TableCell>
              </TableRow>
            ) : (
              periods.map((p: Record<string, any>) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{new Date(p.startDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(p.endDate).toLocaleDateString()}</TableCell>
                  <TableCell>{p.payDate ? new Date(p.payDate).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{p._count.runs}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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