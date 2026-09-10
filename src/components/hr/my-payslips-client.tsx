"use client";

import useSWR from "swr";
import { useState } from "react";
import { Eye } from "lucide-react";
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{payslip?.periodName}</DialogTitle>
            <DialogDescription>
              Payslip issued {payslip ? fmtDate(payslip.createdAt) : ""}
            </DialogDescription>
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
              {Object.entries(payslip.breakdown ?? {}).length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Breakdown</p>
                  {Object.entries(payslip.breakdown).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-muted-foreground">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <span>{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}