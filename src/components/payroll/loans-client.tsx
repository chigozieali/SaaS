"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus, CheckCheck, X, HandCoins, BadgeCheck } from "lucide-react";
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

const badgeVariant: Record<string, "warning" | "success" | "destructive" | "info" | "outline" | "secondary"> = {
  pending: "warning",
  approved: "info",
  active: "success",
  paid_off: "outline",
  rejected: "destructive",
};

type LoanRow = {
  id: string;
  amount: number;
  monthlyDeduction: number;
  durationMonths: number;
  purpose: string | null;
  status: string;
  outstandingBalance: number;
  totalRepaid: number;
  repaymentCount: number;
  employee: { id: string; firstName: string; lastName: string; employeeCode: string };
};

type EmployeeOption = { id: string; firstName: string; lastName: string; employeeCode: string };

export function LoansClient() {
  const { data, mutate, isLoading } = useSWR("/api/hr/loans", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");

  const loans = data?.loans ?? [];
  const employees: EmployeeOption[] = data?.employees ?? [];
  const activeBalance = loans
    .filter((l: LoanRow) => l.status === "active")
    .reduce((s: number, l: LoanRow) => s + Number(l.outstandingBalance), 0);

  const columns: ColumnDef<LoanRow>[] = [
    {
      accessorFn: (loan) => `${loan.employee.firstName} ${loan.employee.lastName}`,
      id: "employee",
      header: "Employee",
      cell: ({ row }) => (
        <div>
          <span className="font-medium">
            {row.original.employee.firstName} {row.original.employee.lastName}
          </span>
          <span className="block text-xs text-muted-foreground">{row.original.employee.employeeCode}</span>
        </div>
      ),
    },
    {
      accessorFn: (loan) => Number(loan.amount),
      id: "amount",
      header: "Amount",
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => <span>{Number(row.original.amount).toLocaleString()}</span>,
    },
    {
      accessorFn: (loan) => Number(loan.monthlyDeduction),
      id: "monthly",
      header: "Monthly repayment",
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => <span>{Number(row.original.monthlyDeduction).toLocaleString()}</span>,
    },
    {
      accessorFn: (loan) => loan.durationMonths,
      id: "term",
      header: "Term",
      cell: ({ row }) => <span>{row.original.durationMonths} mo</span>,
    },
    {
      accessorFn: (loan) => Number(loan.outstandingBalance),
      id: "outstanding",
      header: "Outstanding",
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => <span>{Number(row.original.outstandingBalance).toLocaleString()}</span>,
    },
    {
      accessorFn: (loan) => loan.status,
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={badgeVariant[row.original.status] ?? "outline"}>
          {row.original.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {row.original.status === "pending" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={busyId === row.original.id}
                onClick={() => act(row.original.id, "approve")}
              >
                <CheckCheck className="h-3 w-3" /> Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                disabled={busyId === row.original.id}
                onClick={() => act(row.original.id, "reject")}
              >
                <X className="h-3 w-3" /> Reject
              </Button>
            </>
          )}
          {row.original.status === "approved" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              disabled={busyId === row.original.id}
              onClick={() => act(row.original.id, "disburse")}
            >
              <HandCoins className="h-3 w-3" /> Disburse
            </Button>
          )}
          {row.original.status === "active" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              disabled={busyId === row.original.id || Number(row.original.outstandingBalance) > 0}
              title={
                Number(row.original.outstandingBalance) > 0
                  ? "Cleared via payroll deductions"
                  : "Mark fully repaid"
              }
              onClick={() => act(row.original.id, "mark-paid-off")}
            >
              <BadgeCheck className="h-3 w-3" /> Paid off
            </Button>
          )}
        </div>
      ),
    },
  ];

  async function act(id: string, action: string) {
    setBusyId(id);
    const res = await fetch(`/api/hr/loans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (res.ok) {
      toast.success(action === "disburse" ? "Loan disbursed to GL" : `Loan ${action.replace("-", " ")}`);
      mutate();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Operation failed");
    }
  }

  async function createLoan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      employeeId,
      amount: Number(formData.get("amount")),
      durationMonths: Number(formData.get("durationMonths")),
      purpose: (formData.get("purpose") as string) || undefined,
    };
    setSaving(true);
    const res = await fetch("/api/hr/loans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Loan request created");
      mutate();
      setOpen(false);
      setEmployeeId("");
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to create loan");
    }
  }

  return (
    <div>
      <PageHeader title="Staff Loans & Advances" description="Grant, approve, disburse and track payroll-deducted loans.">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Loan
        </Button>
      </PageHeader>

      <div className="mb-4 flex gap-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Active outstanding balance</p>
          <p className="mt-1 text-2xl font-semibold">{activeBalance.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Open requests</p>
          <p className="mt-1 text-2xl font-semibold">
            {loans.filter((l: LoanRow) => l.status === "pending").length}
          </p>
        </Card>
      </div>

      {isLoading ? (
        <Card className="p-4 text-sm text-muted-foreground">Loading loans…</Card>
      ) : loans.length === 0 ? (
        <EmptyState
          title="No loans yet"
          description="Create a staff loan request to get started."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Loan
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={loans as LoanRow[]}
            filterKeys={["employee.firstName", "status", "purpose"]}
            searchPlaceholder="Search loans…"
            emptyMessage="No loans match your search"
            pageSize={10}
          />
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Staff Loan</DialogTitle>
            <DialogDescription>
              Repayment is deducted from the employee&apos;s monthly pay and booked against Staff Loans Receivable.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createLoan} className="space-y-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={employeeId || undefined} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="durationMonths">Term (months)</Label>
                <Input id="durationMonths" name="durationMonths" type="number" min={1} defaultValue={6} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose (optional)</Label>
              <Input id="purpose" name="purpose" placeholder="e.g. Salary advance" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !employeeId}>
                {saving ? "Creating…" : "Create loan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}