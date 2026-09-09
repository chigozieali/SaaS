"use client";

import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const fmtDate = (d: string) => new Date(d).toLocaleDateString();
const today = new Date(new Date().toISOString().slice(0, 10));

type LeaveRow = {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
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
  me: { firstName: string } | null;
  team: TeamMember[];
};

function inLeave(leave: LeaveRow): boolean {
  const start = new Date(leave.startDate.slice(0, 10));
  const end = new Date(leave.endDate.slice(0, 10));
  return start <= today && today <= end;
}

export function MyTeamClient() {
  const { data } = useSWR<MyRecordsData>("/api/hr/my-records", fetcher);
  const team = data?.team ?? [];

  function teamStatus(member: TeamMember) {
    const leaves = member.leaves ?? [];
    const current = leaves.find(inLeave);
    if (current) return { status: "On leave", leave: current } as const;
    const upcoming = leaves.find((l) => new Date(l.startDate.slice(0, 10)) > today);
    if (upcoming) return { status: "Upcoming", leave: upcoming } as const;
    return { status: "Available", leave: null } as const;
  }

  const columns: ColumnDef<TeamMember>[] = [
    {
      accessorFn: (m) => `${m.firstName} ${m.lastName}`,
      id: "member",
      header: "Member",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.firstName} {row.original.lastName}
        </span>
      ),
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
            variant={status === "On leave" ? "info" : status === "Upcoming" ? "warning" : "success"}
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

  if (!data) return null;

  if (!data.me) {
    return (
      <div>
        <PageHeader title="My Team" description="Your department colleagues." />
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
        title="My Team"
        description="Your department colleagues and their leave status."
      />
      {team.length === 0 ? (
        <EmptyState title="No team assigned" description="You are not assigned to a department yet." />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={team}
            filterKeys={["firstName", "lastName", "position.title"]}
            searchPlaceholder="Search team…"
            emptyMessage="No team members match your search"
            pageSize={10}
          />
        </Card>
      )}
    </div>
  );
}