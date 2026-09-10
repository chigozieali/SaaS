"use client";

import useSWR from "swr";
import { useState } from "react";
import { Download } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/modules/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type ReportAccountRow = { code: string; name: string; balance: number };
type TrialBalanceRow = { code: string; name: string; debit: number | null; credit: number | null };
type LedgerRow = {
  date: string;
  entryNumber: string;
  accountCode: string;
  accountName: string;
  description: string | null;
  reference: string | null;
  debit: number | null;
  credit: number | null;
  cumulativeBalance: number;
};

function downloadCsv(filename: string, columns: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [columns.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportReport(type: string, report: Record<string, unknown> | null | undefined) {
  if (!report) return;
  const today = new Date().toISOString().slice(0, 10);
  const columns = ["Code", "Account", "Debit", "Credit", "Balance"];
  const rows: (string | number)[][] = [];

  if (type === "general_ledger") {
    for (const l of (report as unknown as LedgerRow[])) {
      rows.push([
        l.entryNumber,
        `${l.accountCode} ${l.accountName} · ${l.description ?? l.reference ?? ""}`,
        l.debit ? fmt(l.debit) : "",
        l.credit ? fmt(l.credit) : "",
        fmt(l.cumulativeBalance),
      ]);
    }
  } else {
    const sections: { label: string; items?: ReportAccountRow[]; total?: number }[] =
      type === "pl"
        ? [
            { label: "Revenue", items: report.revenueAccounts as ReportAccountRow[], total: report.revenue as number },
            { label: "Expenses", items: report.expenseAccounts as ReportAccountRow[], total: report.expenses as number },
          ]
        : [
            { label: "Assets", items: report.assetAccounts as ReportAccountRow[], total: report.totalAssets as number },
            { label: "Liabilities", items: report.liabilityAccounts as ReportAccountRow[], total: report.totalLiabilities as number },
            { label: "Equity", items: report.equityAccounts as ReportAccountRow[], total: report.totalEquity as number },
          ];
    for (const section of sections) {
      rows.push([section.label]);
      for (const item of section.items ?? []) rows.push([item.code, item.name, "", "", fmt(item.balance)]);
      rows.push(["", `Total ${section.label}`, "", "", fmt(section.total ?? 0)]);
    }
    if (type === "pl") rows.push(["", "Net income", "", "", fmt((report.netIncome as number) ?? 0)]);
  }
  downloadCsv(`${type}_${today}.csv`, columns, rows);
}

const reportAccountColumns: ColumnDef<ReportAccountRow>[] = [
  {
    accessorKey: "code",
    header: "Code",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
  },
  { accessorKey: "name", header: "Account", cell: ({ row }) => <span>{row.original.name}</span> },
  {
    accessorFn: (r) => Number(r.balance),
    id: "amount",
    header: "Amount",
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
    cell: ({ row }) => <span>{fmt(Number(row.original.balance))}</span>,
  },
];

const trialBalanceColumns: ColumnDef<TrialBalanceRow>[] = [
  {
    accessorKey: "code",
    header: "Code",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
  },
  { accessorKey: "name", header: "Account", cell: ({ row }) => <span>{row.original.name}</span> },
  {
    accessorFn: (r) => (r.debit ? Number(r.debit) : null),
    id: "debit",
    header: "Debit",
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
    cell: ({ row }) => (row.original.debit ? <span>{fmt(row.original.debit)}</span> : <span>—</span>),
  },
  {
    accessorFn: (r) => (r.credit ? Number(r.credit) : null),
    id: "credit",
    header: "Credit",
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
    cell: ({ row }) => (row.original.credit ? <span>{fmt(row.original.credit)}</span> : <span>—</span>),
  },
];

const ledgerColumns: ColumnDef<LedgerRow>[] = [
  {
    accessorFn: (l) => new Date(l.date).getTime(),
    id: "date",
    header: "Date",
    cell: ({ row }) => <span>{new Date(row.original.date).toLocaleDateString()}</span>,
  },
  {
    accessorFn: (l) => l.entryNumber,
    id: "entry",
    header: "Entry",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.entryNumber}</span>,
  },
  {
    accessorFn: (l) => `${l.accountCode} ${l.accountName}`,
    id: "account",
    header: "Account",
    cell: ({ row }) => (
      <span>
        <span className="font-mono text-xs">{row.original.accountCode}</span> {row.original.accountName}
      </span>
    ),
  },
  {
    accessorFn: (l) => l.description ?? l.reference ?? "",
    id: "description",
    header: "Description",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.description ?? row.original.reference ?? "—"}
      </span>
    ),
  },
  {
    accessorFn: (l) => (l.debit ? Number(l.debit) : null),
    id: "debit",
    header: "Debit",
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
    cell: ({ row }) => (row.original.debit ? <span>{fmt(row.original.debit)}</span> : <span>—</span>),
  },
  {
    accessorFn: (l) => (l.credit ? Number(l.credit) : null),
    id: "credit",
    header: "Credit",
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
    cell: ({ row }) => (row.original.credit ? <span>{fmt(row.original.credit)}</span> : <span>—</span>),
  },
  {
    accessorFn: (l) => Number(l.cumulativeBalance),
    id: "balance",
    header: "Balance",
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
    cell: ({ row }) => <span className="font-medium">{fmt(Number(row.original.cumulativeBalance))}</span>,
  },
];

function TotalRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
        bold ? "bg-muted/50 font-semibold" : "font-medium"
      }`}
    >
      <span>{label}</span>
      <span>{fmt(value)}</span>
    </div>
  );
}

export function ReportsClient() {
  const [type, setType] = useState("pl");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [accountId, setAccountId] = useState("");
  const [search, setSearch] = useState("");

  const params = new URLSearchParams({ type });
  if (start && (type === "pl" || type === "general_ledger")) params.set("start", start);
  if (end) params.set("end", end);
  if (accountId && type === "general_ledger") params.set("accountId", accountId);
  if (search && type === "general_ledger") params.set("search", search);

  const { data, isLoading } = useSWR(`/api/accounting/reports?${params.toString()}`, fetcher);
  const { data: acctData } = useSWR("/api/accounting/accounts", fetcher);
  const report = data?.report;
  const accounts = acctData?.accounts ?? [];

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Financial statements generated from posted journal entries."
      >
        <Button variant="outline" onClick={() => exportReport(type, report as Record<string, unknown> | null | undefined)}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Tabs value={type} onValueChange={setType}>
          <TabsList>
            <TabsTrigger value="pl">Profit &amp; Loss</TabsTrigger>
            <TabsTrigger value="balance_sheet">Balance Sheet</TabsTrigger>
            <TabsTrigger value="trial_balance">Trial Balance</TabsTrigger>
            <TabsTrigger value="general_ledger">General Ledger</TabsTrigger>
          </TabsList>
        </Tabs>
        {(type === "pl" || type === "general_ledger") && (
          <>
            <div className="space-y-1">
              <Label>From (optional)</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="space-y-1">
              <Label>To (optional)</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-40" />
            </div>
          </>
        )}
        {type === "balance_sheet" && (
          <div className="space-y-1">
            <Label>As of (optional)</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-40" />
          </div>
        )}
        {type === "general_ledger" && (
          <>
            <div className="space-y-1">
              <Label>Account filter</Label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">All accounts</option>
                {accounts.map((a: { id: string; code: string; name: string }) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Search</Label>
              <Input
                type="search"
                placeholder="Reference, description, account…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-64"
              />
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : type === "pl" ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Profit &amp; Loss</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="mb-1 text-sm font-semibold">Revenue</p>
              <DataTable
                columns={reportAccountColumns}
                data={(report?.revenueAccounts ?? []) as ReportAccountRow[]}
                dense
                paginated={false}
                emptyMessage="No revenue accounts"
              />
            </div>
            <TotalRow label="Total revenue" value={report?.revenue ?? 0} />
            <div>
              <p className="mb-1 text-sm font-semibold">Expenses</p>
              <DataTable
                columns={reportAccountColumns}
                data={(report?.expenseAccounts ?? []) as ReportAccountRow[]}
                dense
                paginated={false}
                emptyMessage="No expense accounts"
              />
            </div>
            <TotalRow label="Total expenses" value={report?.expenses ?? 0} />
            <TotalRow label="Net income" value={report?.netIncome ?? 0} bold />
          </CardContent>
        </Card>
      ) : type === "balance_sheet" ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Balance Sheet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-semibold">Assets</p>
            <DataTable
              columns={reportAccountColumns}
              data={(report?.assetAccounts ?? []) as ReportAccountRow[]}
              dense
              paginated={false}
              emptyMessage="No asset accounts"
            />
            <TotalRow label="Total assets" value={report?.totalAssets ?? 0} />
            <p className="text-sm font-semibold">Liabilities</p>
            <DataTable
              columns={reportAccountColumns}
              data={(report?.liabilityAccounts ?? []) as ReportAccountRow[]}
              dense
              paginated={false}
              emptyMessage="No liability accounts"
            />
            <TotalRow label="Total liabilities" value={report?.totalLiabilities ?? 0} />
            <p className="text-sm font-semibold">Equity</p>
            <DataTable
              columns={reportAccountColumns}
              data={(report?.equityAccounts ?? []) as ReportAccountRow[]}
              dense
              paginated={false}
              emptyMessage="No equity accounts"
            />
            <TotalRow label="Total equity" value={report?.totalEquity ?? 0} />
          </CardContent>
        </Card>
      ) : type === "trial_balance" ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Trial Balance</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={report?.balanced ? "success" : "destructive"}>
                {report?.balanced ? "Balanced" : "Out of balance"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Dr {fmt(report?.totalDebit ?? 0)} · Cr {fmt(report?.totalCredit ?? 0)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={trialBalanceColumns}
              data={(report?.rows ?? []) as TrialBalanceRow[]}
              pageSize={25}
              emptyMessage="No accounts to show"
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">General Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={ledgerColumns}
              data={(report ?? []) as LedgerRow[]}
              filterKeys={["entryNumber", "accountCode", "accountName", "description", "reference"]}
              searchPlaceholder="Search ledger…"
              emptyMessage="No ledger entries"
              pageSize={25}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}