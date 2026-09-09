"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { DetailField, DetailGrid } from "@/components/modules/detail-field";
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

const attendanceBadge: Record<string, "success" | "destructive" | "info" | "warning"> = {
  present: "success",
  absent: "destructive",
  on_leave: "info",
  half_day: "warning",
};

const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
const fmtDate = (d: string) => new Date(d).toLocaleDateString();
const today = new Date(new Date().toISOString().slice(0, 10));

type Me = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  hireDate: string | null;
  employmentType: string | null;
  department: { id: string; name: string } | null;
  position: { id: string; title: string } | null;
  manager: { id: string; firstName: string; lastName: string } | null;
};

type AttendanceRow = {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: number | null;
  status: string;
};

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

type TeamMember = {
  id: string;
  firstName: string;
  lastName: string;
  position: { id: string; title: string } | null;
  leaves: LeaveRow[];
};

type MyRecordsData = {
  me: Me | null;
  attendance: AttendanceRow[];
  leaves: LeaveRow[];
  leaveTypes: { id: string; name: string; daysAllowed: number; isPaid: boolean }[];
  team: TeamMember[];
};

function inLeave(leave: LeaveRow): boolean {
  const start = new Date(leave.startDate.slice(0, 10));
  const end = new Date(leave.endDate.slice(0, 10));
  return start <= today && today <= end;
}

function teamStatus(member: TeamMember) {
  const leaves = member.leaves ?? [];
  const current = leaves.find(inLeave);
  if (current) return { status: "On leave", leave: current } as const;
  const upcoming = leaves.find((l) => new Date(l.startDate.slice(0, 10)) > today);
  if (upcoming) return { status: "Upcoming", leave: upcoming } as const;
  return { status: "Available", leave: null } as const;
}

export function MyRecordsClient() {
  const { data, mutate } = useSWR<MyRecordsData>("/api/hr/my-records", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [coveringForId, setCoveringForId] = useState("");

  const me = data?.me ?? null;
  const attendance = data?.attendance ?? [];
  const leaves = data?.leaves ?? [];
  const leaveTypes = data?.leaveTypes ?? [];
  const team = data?.team ?? [];

  const attendanceColumns: ColumnDef<AttendanceRow>[] = [
    {
      accessorFn: (a) => new Date(a.date).getTime(),
      id: "date",
      header: "Date",
      cell: ({ row }) => <span>{fmtDate(row.original.date)}</span>,
    },
    {
      accessorKey: "checkIn",
      header: "Check in",
      cell: ({ row }) => (
        <span>
          {row.original.checkIn
            ? new Date(row.original.checkIn).toLocaleTimeString([], TIME_FORMAT)
            : "—"}
        </span>
      ),
    },
    {
      accessorKey: "checkOut",
      header: "Check out",
      cell: ({ row }) => (
        <span>
          {row.original.checkOut
            ? new Date(row.original.checkOut).toLocaleTimeString([], TIME_FORMAT)
            : "—"}
        </span>
      ),
    },
    {
      accessorFn: (a) => (a.hoursWorked ? Number(a.hoursWorked) : null),
      id: "hours",
      header: "Hours",
      cell: ({ row }) => (
        <span>
          {row.original.hoursWorked ? `${Number(row.original.hoursWorked).toFixed(1)}h` : "—"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={attendanceBadge[row.original.status] ?? "outline"}>
          {row.original.status.replace("_", " ")}
        </Badge>
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

  const teamColumns: ColumnDef<TeamMember>[] = [
    {
      accessorFn: (m) => `${m.firstName} ${m.lastName}`,
      id: "member",
      header: "Member",
      cell: ({ row }) => <span className="font-medium">{row.original.firstName} {row.original.lastName}</span>,
    },
    {
      accessorFn: (m) => m.position?.title ?? "",
      id: "position",
      header: "Position",
      cell: ({ row }) => <span>{row.original.position?.title ?? "—"}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const { status } = teamStatus(row.original);
        return (
          <Badge
            variant={
              status === "On leave" ? "info" : status === "Upcoming" ? "warning" : "success"
            }
          >
            {status}
          </Badge>
        );
      },
    },
    {
      id: "dates",
      header: "Leave dates",
      cell: ({ row }) => {
        const { leave } = teamStatus(row.original);
        return leave ? (
          <span className="text-sm text-muted-foreground">
            {fmtDate(leave.startDate)} – {fmtDate(leave.endDate)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "covering",
      header: "Covering",
      cell: ({ row }) => {
        const { leave } = teamStatus(row.original);
        return leave?.coveringFor ? (
          <span>
            {leave.coveringFor.firstName} {leave.coveringFor.lastName}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
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

  if (!me) {
    return (
      <div>
        <PageHeader title="My Records" description="Your attendance, leave and team." />
        <EmptyState
          title="No employee record linked"
          description="Your account isn't connected to an employee record yet. Ask an administrator to set your employee email to match your login email."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Records" description="Your attendance, leave and team." />

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold">
          {me.firstName} {me.lastName}
        </h2>
        <DetailGrid>
          <DetailField label="Employee code">
            <span className="font-mono">{me.employeeCode}</span>
          </DetailField>
          <DetailField label="Email">{me.email ?? "—"}</DetailField>
          <DetailField label="Phone">{me.phone ?? "—"}</DetailField>
          <DetailField label="Position">{me.position?.title ?? "—"}</DetailField>
          <DetailField label="Department">{me.department?.name ?? "—"}</DetailField>
          <DetailField label="Manager">
            {me.manager ? `${me.manager.firstName} ${me.manager.lastName}` : "—"}
          </DetailField>
          <DetailField label="Hire date">{me.hireDate ? fmtDate(me.hireDate) : "—"}</DetailField>
          <DetailField label="Employment type">
            {me.employmentType?.replace("_", " ") ?? "—"}
          </DetailField>
        </DetailGrid>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">My Attendance</h2>
        </div>
        {attendance.length === 0 ? (
          <EmptyState title="No attendance records" description="Your attendance will appear here." />
        ) : (
          <Card className="overflow-hidden p-2">
            <DataTable
              columns={attendanceColumns}
              data={attendance}
              paginated={false}
              dense
              emptyMessage="No attendance records"
            />
          </Card>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">My Leave</h2>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3 w-3" /> Request Leave
          </Button>
        </div>
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

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">My Team</h2>
        {team.length === 0 ? (
          <EmptyState
            title="No team assigned"
            description="You are not assigned to a department yet."
          />
        ) : (
          <Card className="overflow-hidden p-2">
            <DataTable
              columns={teamColumns}
              data={team}
              filterKeys={["firstName", "lastName", "position.title"]}
              searchPlaceholder="Search team…"
              emptyMessage="No team members match your search"
              pageSize={10}
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
                    .filter((m) => m.id !== me.id)
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