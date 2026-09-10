"use client";

import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export function MyAttendanceClient() {
  const { data } = useSWR<MyRecordsData>("/api/hr/my-records", fetcher);
  const attendance = data?.attendance ?? [];

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
        <span>{Number(row.original.overtimeHours ?? 0) > 0 ? Number(row.original.overtimeHours).toFixed(1) : "—"}</span>
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