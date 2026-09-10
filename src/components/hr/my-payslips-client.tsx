"use client";

import useSWR from "swr";
import { useState } from "react";
import { Eye, Printer } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { DetailField, DetailGrid } from "@/components/modules/detail-field";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { formatMoney } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const fmtDate = (d: string) => new Date(d).toLocaleDateString();

type Breakdown = {
  basicPay?: number;
  allowances?: Record<string, number>;
  deductions?: Record<string, number>;
  contributions?: Record<string, number>;
  tax?: Record<string, number>;
  overtimePay?: number;
  unpaidDeduction?: number;
};

function entryRows(obj: Record<string, number> | undefined): Array<[string, number]> {
  if (!obj) return [];
  return Object.entries(obj).map(([k, v]) => [k, Number(v ?? 0)]);
}

function printPayslip(row: PayslipRow, currency: string) {
  const b = (row.breakdown ?? {}) as Breakdown;
  const money = (v: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(v || 0));
  const trow = (label: string, val: string) =>
    `<tr><td>${label}</td><td class="r">${val}</td></tr>`;

  const earnings = [
    ...(b.basicPay != null ? [["Basic pay", money(b.basicPay)] as [string, string]] : []),
    ...entryRows(b.allowances).map(([k, v]) => [k, money(v)] as [string, string]),
    ...(b.overtimePay ? [["Overtime pay", money(b.overtimePay)] as [string, string]] : []),
  ];
  const deductions = [
    ...entryRows(b.tax).map(([k, v]) => [k, money(v)] as [string, string]),
    ...entryRows(b.deductions).map(([k, v]) => [k, money(v)] as [string, string]),
    ...(b.unpaidDeduction ? [["Unpaid days", money(b.unpaidDeduction)] as [string, string]] : []),
  ];

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Payslip — ${row.periodName}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#111; margin:32px; }
  h1 { font-size:20px; margin:0 0 2px; }
  .muted { color:#6b7280; font-size:12px; }
  .banner { border-bottom:3px double #374151; padding-bottom:12px; margin-bottom:20px; }
  .section { margin-top:18px; }
  .section h2 { font-size:12px; text-transform:uppercase; letter-spacing:0.05em; color:#374151; margin:0 0 6px; }
  table { width:100%; border-collapse:collapse; }
  td { padding:5px 8px; border-bottom:1px solid #e5e7eb; font-size:13px; }
  td.r { text-align:right; font-variant-numeric: tabular-nums; }
  .total td { font-weight:700; border-top:2px solid #111; border-bottom:none; }
  .net { font-size:18px; font-weight:800; }
  .grid { display:flex; justify-content:space-between; max-width:420px; }
  .grid div { flex:1; }
  .k { color:#6b7280; font-size:11px; text-transform:uppercase; letter-spacing:0.03em; }
  @media print { body { margin:16px; } .no-print { display:none; } }
</style>
</head>
<body>
  <div class="banner">
    <h1>Payslip</h1>
    <div class="muted">${row.periodName} · Issued ${fmtDate(row.createdAt)}</div>
  </div>
  <div class="grid" style="margin-bottom:24px;">
    <div><div class="k">Gross pay</div><div class="net">${money(Number(row.grossPay))}</div></div>
    <div><div class="k">Deductions</div><div class="net">${money(Number(row.totalDeductions))}</div></div>
    <div><div class="k">Net pay</div><div class="net">${money(Number(row.netPay))}</div></div>
  </div>
  <div class="section">
    <h2>Earnings</h2>
    <table>${earnings.map(([k, v]) => trow(k, v)).join("")}</table>
  </div>
  <div class="section">
    <h2>Deductions</h2>
    <table>
      ${deductions.map(([k, v]) => trow(k, v)).join("")}
      <tr class="total"><td>Total deductions</td><td class="r">${money(Number(row.totalDeductions))}</td></tr>
    </table>
  </div>
  <div class="section">
    <table>
      <tr class="total"><td>Net pay</td><td class="r">${money(Number(row.netPay))}</td></tr>
    </table>
  </div>
</body>
</html>`;
  const win = window.open("", "_blank", "width=820,height=1000");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

type PayslipRow = {
  id: string;
  periodName: string;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  breakdown: Record<string, unknown>;
  issuedAt: string | null;
  createdAt: string;
};

type MyRecordsData = {
  me: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    hireDate: string | null;
    department: { id: string; name: string } | null;
    position: { id: string; title: string } | null;
  } | null;
  payslips: PayslipRow[];
  salary: { id: string; basicSalary: number; allowances: Record<string, number> } | null;
  ytdDeductions?: { name: string; amount: number }[];
  currency: string;
};

export function MyPayslipsClient() {
  const { data } = useSWR<MyRecordsData>("/api/hr/my-records", fetcher);
  const [payslip, setPayslip] = useState<PayslipRow | null>(null);

  const payslips = data?.payslips ?? [];
  const salary = data?.salary ?? null;
  const ytdDeductions = data?.ytdDeductions ?? [];
  const currency = data?.currency ?? "NGN";

  const allowancesTotal = salary
    ? Object.values(salary.allowances ?? {}).reduce((a, b) => a + Number(b || 0), 0)
    : 0;

  const columns: ColumnDef<PayslipRow>[] = [
    {
      accessorFn: (p) => new Date(p.createdAt).getTime(),
      id: "createdAt",
      header: "Issued",
      cell: ({ row }) => <span>{fmtDate(row.original.createdAt)}</span>,
    },
    {
      accessorKey: "periodName",
      header: "Period",
      cell: ({ row }) => <span className="font-medium">{row.original.periodName}</span>,
    },
    {
      accessorFn: (p) => Number(p.grossPay),
      id: "gross",
      header: "Gross pay",
      cell: ({ row }) => <span>{formatMoney(Number(row.original.grossPay), currency)}</span>,
    },
    {
      accessorFn: (p) => Number(p.totalDeductions),
      id: "deductions",
      header: "Deductions",
      cell: ({ row }) => <span>{formatMoney(Number(row.original.totalDeductions), currency)}</span>,
    },
    {
      accessorFn: (p) => Number(p.netPay),
      id: "net",
      header: "Net pay",
      cell: ({ row }) => (
        <span className="font-semibold">
          {formatMoney(Number(row.original.netPay), currency)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => (
        <Button size="sm" variant="ghost" className="h-7" onClick={() => setPayslip(row.original)}>
          <Eye className="h-3 w-3" /> Details
        </Button>
      ),
    },
  ];

  if (!data) return null;

  if (!data.me) {
    return (
      <div>
        <PageHeader title="My Payslips" description="Your payslips and salary." />
        <EmptyState
          title="No employee record linked"
          description="Your account isn't connected to an employee record yet. Ask an administrator to set your employee email to match your login email."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Payslips" description="Your payslips and pay information." />

      {salary && (
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold">Salary structure</h2>
          <DetailGrid>
            <DetailField label="Basic salary">
              {formatMoney(salary.basicSalary, currency)}
            </DetailField>
            <DetailField label="Allowances">
              {Object.entries(salary.allowances ?? {}).length
                ? Object.entries(salary.allowances).map(
                    ([k, v]) => `${k}: ${formatMoney(Number(v ?? 0), currency)}`
                  )
                    .join(" · ")
                : "—"}
            </DetailField>
            <DetailField label="Monthly gross">
              {formatMoney(salary.basicSalary + allowancesTotal, currency)}
            </DetailField>
          </DetailGrid>
        </Card>
      )}

      {ytdDeductions.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold">
            Year-to-date deductions ({new Date().getFullYear()})
          </h2>
          <div className="divide-y rounded-md border">
            {ytdDeductions.map((d) => (
              <div key={d.name} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="capitalize">{d.name}</span>
                <span className="font-medium">{formatMoney(d.amount, currency)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {payslips.length === 0 ? (
        <EmptyState
          title="No payslips yet"
          description="Payslips appear after payroll runs are approved."
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={payslips}
            paginated={false}
            dense
            emptyMessage="No payslips"
          />
        </Card>
      )}

      <Dialog open={!!payslip} onOpenChange={(o) => !o && setPayslip(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle>{payslip?.periodName}</DialogTitle>
                <DialogDescription>
                  Payslip issued {payslip ? fmtDate(payslip.createdAt) : ""}
                </DialogDescription>
              </div>
              {payslip ? (
                <Button size="sm" variant="outline" onClick={() => printPayslip(payslip, currency)}>
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
              ) : null}
            </div>
          </DialogHeader>
          {payslip && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Gross pay</p>
                  <p className="font-semibold">{formatMoney(Number(payslip.grossPay), currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Deductions</p>
                  <p className="font-semibold">
                    {formatMoney(Number(payslip.totalDeductions), currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net pay</p>
                  <p className="font-semibold">{formatMoney(Number(payslip.netPay), currency)}</p>
                </div>
              </div>

              {(() => {
                const b = (payslip.breakdown ?? {}) as Breakdown;
                const earnings = [
                  ...(b.basicPay != null ? [["Basic pay", b.basicPay] as [string, number]] : []),
                  ...entryRows(b.allowances),
                  ...(b.overtimePay ? [["Overtime pay", b.overtimePay] as [string, number]] : []),
                ];
                const deductions = [
                  ...entryRows(b.tax),
                  ...entryRows(b.deductions),
                  ...(b.unpaidDeduction ? [["Unpaid days", b.unpaidDeduction] as [string, number]] : []),
                ];
                return (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="mb-2 text-sm font-medium">Earnings</p>
                      <div className="divide-y rounded-md border">
                        {earnings.map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span className="capitalize text-muted-foreground">
                              {k.replace(/([A-Z])/g, " $1").trim()}
                            </span>
                            <span>{formatMoney(Number(v), currency)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between bg-muted px-3 py-2 text-sm font-semibold">
                          <span>Total earnings</span>
                          <span>{formatMoney(Number(payslip.grossPay), currency)}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-medium">Deductions</p>
                      <div className="divide-y rounded-md border">
                        {deductions.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No deductions</div>
                        ) : (
                          deductions.map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between px-3 py-2 text-sm">
                              <span className="capitalize text-muted-foreground">
                                {k.replace(/([A-Z])/g, " $1").trim()}
                              </span>
                              <span>{formatMoney(Number(v), currency)}</span>
                            </div>
                          ))
                        )}
                        <div className="flex items-center justify-between bg-muted px-3 py-2 text-sm font-semibold">
                          <span>Total deductions</span>
                          <span>{formatMoney(Number(payslip.totalDeductions), currency)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}