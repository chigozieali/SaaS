"use client";

import useSWR from "swr";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Run = {
  id: string;
  status: string;
  period: { name: string };
  netPayTotal: number;
  _count: { lines: number };
};

type ReportRow = {
  employeeId: string;
  name: string;
  code: string;
  taxOffice: string | null;
  pfa: string | null;
  grossPay: number;
  overtimePay: number;
  unpaidDeduction: number;
  totalDeductions: number;
  tax: number;
  pensionEmployee: number;
  pensionEmployer: number;
  nhiaEmployee: number;
  nhiaEmployer: number;
  hmoEmployee: number;
  hmoEmployer: number;
  itf: number;
  nsitf: number;
  netPay: number;
};

type Report = {
  rows: ReportRow[];
  byTaxOffice: { taxOffice: string; count: number; tax: number }[];
  byPfa: { pfa: string; count: number; employee: number; employer: number }[];
  totals: Record<string, number> | null;
  run: { id: string; periodName: string; status: string } | null;
};

function sum(rows: ReportRow[], key: keyof ReportRow): number {
  return rows.reduce((a, r) => a + (Number(r[key] ?? 0) || 0), 0);
}

export function ComplianceClient() {
  const { data: runsData } = useSWR<{ runs: Run[] }>("/api/payroll/runs", fetcher);
  const [runId, setRunId] = useState<string>("");
  const { data } = useSWR<Report>(
    runId ? `/api/payroll/reports?runId=${runId}` : null,
    fetcher
  );

  const runs = runsData?.runs ?? [];
  const selected = (runsData?.runs ?? []).find((r) => r.id === runId);
  const rows = data?.rows ?? [];

  if (!runsData) return null;

  const currency = "NGN";

  const columns: ColumnDef<ReportRow>[] = [
    {
      accessorFn: (r) => r.name,
      id: "name",
      header: "Employee",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="font-mono text-xs text-muted-foreground">{row.original.code}</div>
        </div>
      ),
    },
    {
      accessorKey: "taxOffice",
      header: "Tax office",
      cell: ({ row }) => <span>{row.original.taxOffice || "—"}</span>,
    },
    {
      accessorKey: "pfa",
      header: "PFA",
      cell: ({ row }) => <span>{row.original.pfa || "—"}</span>,
    },
    {
      accessorFn: (r) => r.grossPay,
      id: "gross",
      header: "Gross pay",
      cell: ({ row }) => <span>{formatMoney(row.original.grossPay, currency)}</span>,
    },
    {
      accessorFn: (r) => r.tax,
      id: "tax",
      header: "PAYE",
      cell: ({ row }) => <span>{formatMoney(row.original.tax, currency)}</span>,
    },
    {
      accessorFn: (r) => r.pensionEmployee,
      id: "pensionEe",
      header: "Pension (ee)",
      cell: ({ row }) => <span>{formatMoney(row.original.pensionEmployee, currency)}</span>,
    },
    {
      accessorFn: (r) => r.pensionEmployer,
      id: "pensionEr",
      header: "Pension (er)",
      cell: ({ row }) => <span>{formatMoney(row.original.pensionEmployer, currency)}</span>,
    },
    {
      accessorFn: (r) => r.itf,
      id: "itf",
      header: "ITF",
      cell: ({ row }) => <span>{formatMoney(row.original.itf, currency)}</span>,
    },
    {
      accessorFn: (r) => r.nsitf,
      id: "nsitf",
      header: "NSITF",
      cell: ({ row }) => <span>{formatMoney(row.original.nsitf, currency)}</span>,
    },
    {
      accessorFn: (r) => r.netPay,
      id: "net",
      header: "Net pay",
      cell: ({ row }) => <span className="font-medium">{formatMoney(row.original.netPay, currency)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statutory Compliance"
        description="Remittance view of the latest payroll run: PAYE by tax office, pension by PFA, ITF and NSITF."
      />

      <Card className="flex items-center gap-4 p-4">
        <p className="text-sm font-medium">Payroll run</p>
        <Select value={runId} onValueChange={setRunId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Select a finalized run" />
          </SelectTrigger>
          <SelectContent>
            {runs.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.period.name} ({r.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected ? (
          <p className="text-sm text-muted-foreground">
            {selected._count.lines} employees · net {formatMoney(selected.netPayTotal, currency)}
          </p>
        ) : null}
      </Card>

      {!runId ? (
        <EmptyState
          title="Select a payroll run"
          description="Choose a finalized payroll run above to view statutory remittance figures."
        />
      ) : !data ? null : rows.length === 0 ? (
        <EmptyState title="No data" description="This run has no payroll lines." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Total PAYE</p>
              <p className="mt-1 text-2xl font-bold">{formatMoney(sum(rows, "tax"), currency)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Pension (employee)</p>
              <p className="mt-1 text-2xl font-bold">{formatMoney(sum(rows, "pensionEmployee"), currency)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Pension (employer)</p>
              <p className="mt-1 text-2xl font-bold">{formatMoney(sum(rows, "pensionEmployer"), currency)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">ITF + NSITF</p>
              <p className="mt-1 text-2xl font-bold">
                {formatMoney(sum(rows, "itf") + sum(rows, "nsitf"), currency)}
              </p>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <h2 className="mb-4 text-sm font-semibold">PAYE by tax office</h2>
              <div className="divide-y rounded-md border">
                {(data.byTaxOffice ?? []).map((t) => (
                  <div key={t.taxOffice} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      {t.taxOffice}{" "}
                      <span className="text-xs text-muted-foreground">({t.count})</span>
                    </span>
                    <span className="font-medium">{formatMoney(t.tax, currency)}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-6">
              <h2 className="mb-4 text-sm font-semibold">Pension by PFA</h2>
              <div className="divide-y rounded-md border">
                {(data.byPfa ?? []).map((p) => (
                  <div key={p.pfa} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      {p.pfa} <span className="text-xs text-muted-foreground">({p.count})</span>
                    </span>
                    <span className="font-medium">
                      {formatMoney(p.employee + p.employer, currency)}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ee {formatMoney(p.employee, currency)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden p-2">
            <DataTable
              columns={columns}
              data={rows}
              filterKeys={["name", "code", "taxOffice", "pfa"]}
              searchPlaceholder="Search employees…"
              emptyMessage="No rows match"
              pageSize={10}
            />
          </Card>
        </>
      )}
    </div>
  );
}