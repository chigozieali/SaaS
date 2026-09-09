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
const badgeVariant: Record<string, "warning" | "success" | "destructive" | "info" | "outline"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "outline",
};

type LeaveRow = {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  employee: { firstName: string; lastName: string };
  leaveType: { name: string };
  coveringFor: { firstName: string; lastName: string } | null;
};

export function LeaveClient({ canManage = true }: { canManage?: boolean }) {
  const { data, mutate } = useSWR("/api/hr/leave", fetcher);
  const { data: empData } = useSWR(canManage ? "/api/hr/employees" : null, fetcher);
  const { data: typeData } = useSWR("/api/hr/leave-types", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [coveringForId, setCoveringForId] = useState("");

  const leaves = data?.leaves ?? [];
  const employees = empData?.employees ?? [];
  const leaveTypes = typeData?.leaveTypes ?? [];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const start = formData.get("startDate") as string;
    const end = formData.get("endDate") as string;
    const days = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);

    const payload = {
      ...(canManage ? { employeeId } : {}),
      leaveTypeId,
      startDate: start,
      endDate: end,
      days,
      reason: formData.get("reason") ?? undefined,
      ...(canManage ? { coveringForId: coveringForId || undefined } : {}),
    };

    setSaving(true);
    const res = await fetch("/api/hr/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Leave request submitted");
      mutate();
      setOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to submit leave request");
    }
  }

  async function decide(id: string, status: string) {
    const res = await fetch(`/api/hr/leave/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(`Leave ${status}`);
      mutate();
    } else {
      toast.error("Failed to update leave");
    }
  }

  const columns: ColumnDef<LeaveRow>[] = [
    {
      accessorFn: (l) => `${l.employee.firstName} ${l.employee.lastName}`,
      id: "employee",
      header: "Employee",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.employee.firstName} {row.original.employee.lastName}
        </span>
      ),
    },
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
      cell: ({ row }) => <span>{new Date(row.original.startDate).toLocaleDateString()}</span>,
    },
    {
      accessorFn: (l) => new Date(l.endDate).getTime(),
      id: "end",
      header: "End",
      cell: ({ row }) => <span>{new Date(row.original.endDate).toLocaleDateString()}</span>,
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
        <Badge variant={badgeVariant[row.original.status] ?? "outline"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorFn: (l) => l.coveringFor ? `${l.coveringFor.firstName} ${l.coveringFor.lastName}` : "",
      id: "covering",
      header: "Covering",
      cell: ({ row }) => (
        <span>
          {row.original.coveringFor
            ? `${row.original.coveringFor.firstName} ${row.original.coveringFor.lastName}`
            : "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) =>
        row.original.status === "pending" ? (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => decide(row.original.id, "approved")}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => decide(row.original.id, "rejected")}
            >
              Reject
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title="Leave Management" description="Track and approve leave requests.">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Request Leave
        </Button>
      </PageHeader>

      {leaves.length === 0 ? (
        <EmptyState
          title="No leave requests"
          description="Submit a leave request to get started."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Request Leave
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={leaves as LeaveRow[]}
            filterKeys={["employee.firstName", "employee.lastName", "leaveType.name", "status"]}
            searchPlaceholder="Search leave requests…"
            emptyMessage="No leave requests match your search"
            pageSize={10}
          />
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>Submit a new leave request for an employee.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            {canManage && (
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select value={employeeId || undefined} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e: { id: string; firstName: string; lastName: string }) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.firstName} {e.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Leave type</Label>
              <Select value={leaveTypeId || undefined} onValueChange={setLeaveTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((t: { id: string; name: string }) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canManage && (
              <div className="space-y-2">
                <Label>Covering colleague (optional)</Label>
                <Select value={coveringForId || undefined} onValueChange={setCoveringForId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select covering employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter((e: { id: string }) => e.id !== employeeId)
                      .map((e: { id: string; firstName: string; lastName: string }) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.firstName} {e.lastName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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