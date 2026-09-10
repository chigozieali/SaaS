"use client";

import useSWR from "swr";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ReportRow = {
  employeeId: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  department: string | null;
  position: string | null;
  isConfirmed: boolean;
  acknowledgementCount: number;
  disciplinaryCount: number;
  gaps: string[];
  gapCount: number;
};

type Report = {
  rows: ReportRow[];
  counts: Record<string, number>;
  gapLabels: Record<string, string>;
  total: number;
};

const CARD_ORDER: [string, string][] = [
  ["bank", "No bank details"],
  ["tin", "No TIN"],
  ["taxOffice", "No tax office"],
  ["pfa", "No PFA"],
  ["rsa", "No RSA PIN"],
  ["nin", "No NIN"],
  ["confirmation", "Unconfirmed"],
  ["acknowledgements", "No policy acknowledgements"],
];

export function HrComplianceClient() {
  const { data } = useSWR<Report>("/api/hr/compliance-report", fetcher);

  if (!data) return null;

  const columns: ColumnDef<ReportRow>[] = [
    {
      accessorFn: (r) => `${r.firstName} ${r.lastName}`,
      id: "employee",
      header: "Employee",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.firstName} {row.original.lastName}
          </div>
          <div className="font-mono text-xs text-muted-foreground">{row.original.employeeCode}</div>
        </div>
      ),
    },
    {
      accessorKey: "department",
      header: "Department",
      cell: ({ row }) => <span>{row.original.department || "—"}</span>,
    },
    {
      accessorFn: (r) => r.gapCount,
      id: "gaps",
      header: "Missing items",
      cell: ({ row }) =>
        row.original.gaps.length === 0 ? (
          <Badge variant="success">Complete</Badge>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.original.gaps.map((g) => (
              <Badge key={g} variant="warning">
                {data.gapLabels[g] ?? g}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      accessorFn: (r) => r.disciplinaryCount,
      id: "disciplinary",
      header: "Disciplinary",
      cell: ({ row }) => <span>{row.original.disciplinaryCount}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="HR Compliance"
        description="Staffing compliance checks: statutory identifiers, confirmation and policy acknowledgements."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARD_ORDER.map(([key, label]) => (
          <Card key={key} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{data.counts[key] ?? 0}</p>
            <p className="text-xs text-muted-foreground">of {data.total} employees</p>
          </Card>
        ))}
      </div>

      {data.rows.length === 0 ? (
        <EmptyState title="No employees" description="Add employees to run compliance checks." />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={data.rows}
            filterKeys={["firstName", "lastName", "employeeCode", "department"]}
            searchPlaceholder="Search employees…"
            emptyMessage="No employees match"
            pageSize={10}
          />
        </Card>
      )}
    </div>
  );
}