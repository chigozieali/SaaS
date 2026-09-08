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
  present: "success",
  absent: "destructive",
  on_leave: "info",
  half_day: "warning",
};

type AttendanceRow = {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: number | null;
  status: string;
  employee: { firstName: string; lastName: string };
};

const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

export function AttendanceClient() {
  const { data, mutate } = useSWR("/api/hr/attendance", fetcher);
  const { data: empData } = useSWR("/api/hr/employees", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("present");

  const attendances = data?.attendances ?? [];
  const employees = empData?.employees ?? [];

  const columns: ColumnDef<AttendanceRow>[] = [
    {
      accessorFn: (a) => `${a.employee.firstName} ${a.employee.lastName}`,
      id: "employee",
      header: "Employee",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.employee.firstName} {row.original.employee.lastName}
        </span>
      ),
    },
    {
      accessorFn: (a) => new Date(a.date).getTime(),
      id: "date",
      header: "Date",
      cell: ({ row }) => <span>{new Date(row.original.date).toLocaleDateString()}</span>,
    },
    {
      accessorFn: (a) => (a.checkIn ? new Date(a.checkIn).getTime() : null),
      id: "checkIn",
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
      accessorFn: (a) => (a.checkOut ? new Date(a.checkOut).getTime() : null),
      id: "checkOut",
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
      accessorFn: (a) => a.status,
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={badgeVariant[row.original.status] ?? "outline"}>
          {row.original.status.replace("_", " ")}
        </Badge>
      ),
    },
  ];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      employeeId,
      date: formData.get("date"),
      checkIn: (formData.get("checkIn") as string) || null,
      checkOut: (formData.get("checkOut") as string) || null,
      status,
    };
    setSaving(true);
    const res = await fetch("/api/hr/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Attendance recorded");
      mutate();
      setOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to record attendance");
    }
  }

  return (
    <div>
      <PageHeader title="Attendance" description="Record daily employee attendance.">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Record Attendance
        </Button>
      </PageHeader>

      {attendances.length === 0 ? (
        <EmptyState
          title="No attendance records"
          description="Record attendance for a day to get started."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Record Attendance
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={attendances as AttendanceRow[]}
            filterKeys={["employee.firstName", "employee.lastName", "status"]}
            searchPlaceholder="Search attendance…"
            emptyMessage="No attendance records match your search"
            pageSize={25}
          />
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Attendance</DialogTitle>
            <DialogDescription>Log an attendance entry for an employee.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
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
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkIn">Check in</Label>
                <Input id="checkIn" name="checkIn" type="time" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOut">Check out</Label>
                <Input id="checkOut" name="checkOut" type="time" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="on_leave">On leave</SelectItem>
                  <SelectItem value="half_day">Half day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}