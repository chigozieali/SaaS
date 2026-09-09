"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const leaveBadge: Record<string, "warning" | "success" | "destructive" | "outline"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "outline",
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString();

type LeaveRow = {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason: string | null;
  leaveType: { name: string };
  coveringFor: { id: string; firstName: string; lastName: string } | null;
};

type LeaveBalanceRow = {
  leaveTypeId: string;
  name: string;
  allowed: number;
  taken: number;
  pending: number;
  remaining: number;
};

type TeamMember = { id: string; firstName: string; lastName: string; position: { id: string; title: string } | null };

type MyRecordsData = {
  me: { id: string; firstName: string } | null;
  leaves: LeaveRow[];
  leaveTypes: { id: string; name: string; daysAllowed: number; isPaid: boolean }[];
  leaveBalance: LeaveBalanceRow[];
  team: TeamMember[];
};

export function MyLeaveClient() {
  const { data, mutate } = useSWR<MyRecordsData>("/api/hr/my-records", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [coveringForId, setCoveringForId] = useState("");

  const leaves = data?.leaves ?? [];
  const leaveTypes = data?.leaveTypes ?? [];
  const leaveBalance = data?.leaveBalance ?? [];
  const team = data?.team ?? [];
  const meId = data?.me?.id;

  const balanceColumns: ColumnDef<LeaveBalanceRow>[] = [
    {
      accessorKey: "name",
      header: "Leave type",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorFn: (r) => r.allowed,
      id: "allowed",
      header: "Allowed",
    },
    {
      accessorFn: (r) => r.taken,
      id: "taken",
      header: "Taken",
      cell: ({ row }) => <span>{row.original.taken.toFixed(1)}</span>,
    },
    {
      accessorFn: (r) => r.pending,
      id: "pending",
      header: "Pending",
      cell: ({ row }) => <span>{row.original.pending.toFixed(1)}</span>,
    },
    {
      accessorFn: (r) => r.remaining,
      id: "remaining",
      header: "Remaining",
      cell: ({ row }) => (
        <span className="font-semibold">
          {row.original.remaining.toFixed(1)}
          {row.original.remaining <= 0 ? (
            <Badge variant="destructive" className="ml-2">
              Exhausted
            </Badge>
          ) : row.original.remaining <= Math.ceil(row.original.allowed * 0.2) ? (
            <Badge variant="warning" className="ml-2">
              Low
            </Badge>
          ) : null}
        </span>
      ),
    },
  ];

  const leaveColumns: ColumnDef<LeaveRow>[] = [
    {
      accessorFn: (l) => l.leaveType.name,
      id: "type",
      header: "Type",
      cell: ({ row }) => <span>{row.original.leaveType.name}</span>,
    },
    {
      accessorFn: (l) => new Date(l.startDate).getTime(),
      id: "start",
      header: "Start",
      cell: ({ row }) => <span>{fmtDate(row.original.startDate)}</span>,
    },
    {
      accessorFn: (l) => new Date(l.endDate).getTime(),
      id: "end",
      header: "End",
      cell: ({ row }) => <span>{fmtDate(row.original.endDate)}</span>,
    },
    {
      accessorFn: (l) => Number(l.days),
      id: "days",
      header: "Days",
    },
    {
      accessorFn: (l) => l.status,
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={leaveBadge[row.original.status] ?? "outline"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorFn: (l) =>
        l.coveringFor ? `${l.coveringFor.firstName} ${l.coveringFor.lastName}` : "",
      id: "covering",
      header: "Covered by",
      cell: ({ row }) => (
        <span>
          {row.original.coveringFor
            ? `${row.original.coveringFor.firstName} ${row.original.coveringFor.lastName}`
            : "—"}
        </span>
      ),
    },
  ];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const start = formData.get("startDate") as string;
    const end = formData.get("endDate") as string;
    const days =
      Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);

    setSaving(true);
    const res = await fetch("/api/hr/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leaveTypeId,
        startDate: start,
        endDate: end,
        days,
        reason: formData.get("reason") || undefined,
        coveringForId: coveringForId || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Leave request submitted");
      mutate();
      setOpen(false);
      setLeaveTypeId("");
      setCoveringForId("");
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to submit leave request");
    }
  }

  if (!data) return null;

  if (!data.me) {
    return (
      <div>
        <PageHeader title="My Leave" description="Your leave balance and requests." />
        <EmptyState
          title="No employee record linked"
          description="Your account isn't connected to an employee record yet. Ask an administrator to set your employee email to match your login email."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Leave" description="Your leave balance, history and requests.">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Request Leave
        </Button>
      </PageHeader>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Leave Balance</h2>
        {leaveBalance.length === 0 ? (
          <EmptyState title="No leave types" description="Leave types will appear here." />
        ) : (
          <Card className="overflow-hidden p-2">
            <DataTable
              columns={balanceColumns}
              data={leaveBalance}
              paginated={false}
              dense
              emptyMessage="No leave types"
            />
          </Card>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Leave History</h2>
        {leaves.length === 0 ? (
          <EmptyState title="No leave requests" description="Submit a leave request to get started." />
        ) : (
          <Card className="overflow-hidden p-2">
            <DataTable
              columns={leaveColumns}
              data={leaves}
              paginated={false}
              dense
              emptyMessage="No leave requests"
            />
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>Submit a leave request. A manager will review it.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Leave type</Label>
              <Select value={leaveTypeId || undefined} onValueChange={setLeaveTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label>Covering colleague (optional)</Label>
              <Select value={coveringForId || undefined} onValueChange={setCoveringForId}>
                <SelectTrigger>
                  <SelectValue placeholder="Who covers your duties?" />
                </SelectTrigger>
                <SelectContent>
                  {team
                    .filter((m) => m.id !== meId)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.firstName} {m.lastName}
                        {m.position ? ` · ${m.position.title}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input id="reason" name="reason" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Submitting…" : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}