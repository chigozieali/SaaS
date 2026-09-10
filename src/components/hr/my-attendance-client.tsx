"use client";

import useSWR from "swr";
import { useState } from "react";
import { AlarmClock, LogIn, LogOut } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const attendanceBadge: Record<string, "success" | "destructive" | "info" | "warning"> = {
  present: "success",
  absent: "destructive",
  on_leave: "info",
  half_day: "warning",
};

const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
const fmtDate = (d: string) => new Date(d).toLocaleDateString();
const fmtTime = (d: string) => new Date(d).toLocaleTimeString([], TIME_FORMAT);

type AttendanceRow = {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: number | null;
  overtimeHours: number | string;
  status: string;
  employee: { firstName: string; lastName: string } | null;
};

type MyRecordsData = {
  me: { firstName: string } | null;
  attendance: AttendanceRow[];
};

type TodayData = {
  record: {
    id: string;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    hoursWorked: number | null;
    overtimeHours: number;
    status: string;
  } | null;
};

export function MyAttendanceClient() {
  const { data } = useSWR<MyRecordsData>("/api/hr/my-records", fetcher);
  const { data: todayData, mutate: mutateToday } = useSWR<TodayData>(
    "/api/hr/attendance/self",
    fetcher,
    { refreshInterval: 60_000 }
  );
  const [working, setWorking] = useState(false);
  const attendance = data?.attendance ?? [];
  const today = todayData?.record ?? null;

  async function clock(action: "in" | "out") {
    setWorking(true);
    const res = await fetch("/api/hr/attendance/self", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setWorking(false);
    const d = await res.json().catch(() => null);
    if (res.ok) {
      toast.success(action === "in" ? "Clocked in — have a great day!" : "Clocked out");
      mutateToday();
    } else {
      toast.error(d?.message ?? `Failed to ${action === "in" ? "clock in" : "clock out"}`);
    }
  }

  const columns: ColumnDef<AttendanceRow>[] = [
    {
      accessorFn: (a) => new Date(a.date).getTime(),
      id: "date",
      header: "Date",
      cell: ({ row }) => <span>{fmtDate(row.original.date)}</span>,
    },
    {
      id: "record",
      header: "Record",
      cell: ({ row }) =>
        row.original.employee ? (
          <span>
            Covering –{" "}
            <span className="font-medium">
              {row.original.employee.firstName} {row.original.employee.lastName}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">Own</span>
        ),
    },
    {
      accessorKey: "checkIn",
      header: "Check in",
      cell: ({ row }) => (
        <span>{row.original.checkIn ? fmtTime(row.original.checkIn) : "—"}</span>
      ),
    },
    {
      accessorKey: "checkOut",
      header: "Check out",
      cell: ({ row }) => (
        <span>{row.original.checkOut ? fmtTime(row.original.checkOut) : "—"}</span>
      ),
    },
    {
      accessorFn: (a) => (a.hoursWorked ? Number(a.hoursWorked) : null),
      id: "hours",
      header: "Hours",
      cell: ({ row }) => (
        <span>{row.original.hoursWorked ? `${Number(row.original.hoursWorked).toFixed(1)}h` : "—"}</span>
      ),
    },
    {
      accessorFn: (a) => a.status,
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={attendanceBadge[row.original.status] ?? "outline"}>
          {row.original.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      accessorFn: (a) => Number(a.overtimeHours ?? 0),
      id: "overtime",
      header: "OT (h)",
      cell: ({ row }) => (
        <span>
          {Number(row.original.overtimeHours ?? 0) > 0 ? Number(row.original.overtimeHours).toFixed(1) : "—"}
        </span>
      ),
    },
  ];

  if (!data) return null;

  if (!data.me) {
    return (
      <div>
        <PageHeader title="My Attendance" description="Your attendance and relief coverage." />
        <EmptyState
          title="No employee record linked"
          description="Your account isn't connected to an employee record yet. Ask an administrator to set your employee email to match your login email."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Attendance"
        description="Your attendance records, plus colleagues who covered for you."
      />

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <AlarmClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Today — {fmtDate(new Date().toISOString())}</p>
              <p className="text-sm text-muted-foreground">
                {!today
                  ? "Not clocked in yet."
                  : today.checkOut
                    ? `Checked out at ${fmtTime(today.checkOut)} · ${Number(today.hoursWorked ?? 0).toFixed(1)}h worked`
                    : `Clocked in at ${fmtTime(today.checkIn ?? today.date)}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!today?.checkIn ? (
              <Button onClick={() => clock("in")} disabled={working}>
                <LogIn className="mr-2 h-4 w-4" /> Clock in
              </Button>
            ) : null}
            {today?.checkIn && !today?.checkOut ? (
              <Button variant="outline" onClick={() => clock("out")} disabled={working}>
                <LogOut className="mr-2 h-4 w-4" /> Clock out
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {attendance.length === 0 ? (
        <EmptyState title="No attendance records" description="Your attendance will appear here." />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={attendance}
            paginated={false}
            dense
            emptyMessage="No attendance records"
          />
        </Card>
      )}
    </div>
  );
}