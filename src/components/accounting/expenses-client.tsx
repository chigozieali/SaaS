"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus, Banknote, Send } from "lucide-react";
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
  paid: "success",
  rejected: "destructive",
  cancelled: "outline",
};

const methodLabel: Record<string, string> = {
  payroll: "Payroll",
  bank: "Bank",
};

type ExpenseRow = {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  status: string;
  reimbursementMethod: string | null;
  employeeId: string | null;
  payrollRunId: string | null;
  paidAt: string | null;
  category?: { name: string } | null;
  vendor?: { name: string } | null;
  employee?: { firstName: string; lastName: string } | null;
  payrollRun?: { period?: { name: string } } | null;
};

type EmployeeOption = { id: string; firstName: string; lastName: string; employeeCode: string };
type RunOption = { id: string; status: string; period: { name: string } };

export function ExpensesClient() {
  const { data, mutate } = useSWR("/api/accounting/expenses", fetcher);
  const { data: vendorData } = useSWR("/api/accounting/vendors", fetcher);
  const { data: employeeData } = useSWR("/api/hr/employees", fetcher);
  const { data: runsData } = useSWR("/api/payroll/runs", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [reimbursementMethod, setReimbursementMethod] = useState("bank");
  const [payBankId, setPayBankId] = useState<string | null>(null);
  const [payRun, setPayRun] = useState<{ id: string; payrollRunId: string | null } | null>(null);
  const [selectedRun, setSelectedRun] = useState("");

  const expenses = data?.expenses ?? [];
  const categories = data?.categories ?? [];
  const vendors = vendorData?.vendors ?? [];
  const employees: EmployeeOption[] = employeeData?.employees ?? [];
  const allRuns: RunOption[] = (runsData?.runs ?? []).filter((r: RunOption) =>
    ["draft", "submitted"].includes(r.status)
  );

  const columns: ColumnDef<ExpenseRow>[] = [
    {
      accessorFn: (e) => new Date(e.date).getTime(),
      id: "date",
      header: "Date",
      cell: ({ row }) => <span>{new Date(row.original.date).toLocaleDateString()}</span>,
    },
    {
      accessorFn: (e) => e.description ?? "",
      id: "description",
      header: "Description",
      cell: ({ row }) => <span className="font-medium">{row.original.description ?? "—"}</span>,
    },
    {
      accessorFn: (e) => e.employee?.firstName ?? "",
      id: "employee",
      header: "Employee",
      cell: ({ row }) => {
        const emp = row.original.employee;
        return emp ? (
          <span className="text-muted-foreground">
            {emp.firstName} {emp.lastName}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorFn: (e) => e.category?.name ?? "",
      id: "category",
      header: "Category",
      cell: ({ row }) => <span>{row.original.category?.name ?? "—"}</span>,
    },
    {
      accessorFn: (e) => Number(e.amount),
      id: "amount",
      header: "Amount",
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => <span>{Number(row.original.amount).toLocaleString()}</span>,
    },
    {
      accessorFn: (e) => e.status,
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={badgeVariant[row.original.status] ?? "outline"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorFn: (e) => e.reimbursementMethod ?? "",
      id: "method",
      header: "Payment",
      cell: ({ row }) => {
        const rowData = row.original;
        if (rowData.status === "paid") {
          const method = rowData.reimbursementMethod === "payroll" ? "via payroll" : "by bank";
          return <span className="text-xs text-muted-foreground">{method}</span>;
        }
        if (rowData.payrollRunId) {
          return (
            <span className="text-xs text-muted-foreground">
              → {rowData.payrollRun?.period?.name ?? "run"} (open)
            </span>
          );
        }
        if (rowData.reimbursementMethod) {
          return <Badge variant="secondary">{methodLabel[rowData.reimbursementMethod] ?? rowData.reimbursementMethod}</Badge>;
        }
        return <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => {
        const expense = row.original;
        if (expense.status === "pending") {
          return (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="outline" className="h-7" onClick={() => decide(expense.id, "approved")}>
                Approve
              </Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => decide(expense.id, "rejected")}>
                Reject
              </Button>
            </div>
          );
        }
        if (expense.status === "approved") {
          return (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="outline" className="h-7" onClick={() => setPayBankId(expense.id)}>
                <Banknote className="h-3 w-3" /> Pay bank
              </Button>
              <Button size="sm" variant="outline" className="h-7" disabled={!expense.employeeId} onClick={() => setPayRun({ id: expense.id, payrollRunId: expense.payrollRunId })}>
                <Send className="h-3 w-3" /> Payroll
              </Button>
            </div>
          );
        }
        return null;
      },
    },
  ];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      categoryId: categoryId || null,
      vendorId: vendorId || null,
      employeeId: employeeId || null,
      reimbursementMethod: employeeId ? reimbursementMethod : null,
      amount: Number(formData.get("amount")),
      date: formData.get("date"),
      description: (formData.get("description") as string) || undefined,
    };
    setSaving(true);
    const res = await fetch("/api/accounting/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Expense submitted");
      mutate();
      setOpen(false);
      setEmployeeId("");
      setCategoryId("");
      setVendorId("");
    } else {
      const errData = await res.json().catch(() => null);
      toast.error(errData?.message ?? "Failed to submit expense");
    }
  }

  async function decide(id: string, status: string) {
    const res = await fetch(`/api/accounting/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(`Expense ${status}`);
      mutate();
    } else {
      const errData = await res.json().catch(() => null);
      toast.error(errData?.message ?? "Failed to update expense");
    }
  }

  async function payBank(e: React.FormEvent<HTMLFormElement>) {
    if (!payBankId) return;
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setSaving(true);
    const res = await fetch(`/api/accounting/expenses/${payBankId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pay: {
          method: "bank",
          date: (formData.get("date") as string) || undefined,
          reference: (formData.get("reference") as string) || undefined,
        },
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Expense paid");
      setPayBankId(null);
      mutate();
    } else {
      const errData = await res.json().catch(() => null);
      toast.error(errData?.message ?? "Payment failed");
    }
  }

  async function attachRun() {
    if (!payRun || !selectedRun) return;
    setSaving(true);
    const res = await fetch(`/api/accounting/expenses/${payRun.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pay: { method: "payroll", runId: selectedRun } }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Claim attached to payroll run");
      setPayRun(null);
      setSelectedRun("");
      mutate();
    } else {
      const errData = await res.json().catch(() => null);
      toast.error(errData?.message ?? "Failed to attach to payroll");
    }
  }

  async function detachRun() {
    if (!payRun) return;
    setSaving(true);
    const res = await fetch(`/api/accounting/expenses/${payRun.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pay: { method: "payroll", runId: null } }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Removed from payroll run");
      setPayRun(null);
      setSelectedRun("");
      mutate();
    } else {
      const errData = await res.json().catch(() => null);
      toast.error(errData?.message ?? "Failed to detach");
    }
  }

  async function addCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/accounting/expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formData.get("name") }),
    });
    if (res.ok) {
      toast.success("Category added");
      mutate();
    } else {
      toast.error("Failed to add category");
    }
  }

  return (
    <div>
      <PageHeader title="Expenses" description="Submit, review, approve and reimburse employee expense claims.">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Expense
        </Button>
      </PageHeader>

      {expenses.length === 0 ? (
        <EmptyState
          title="No expenses yet"
          description="Submit an expense claim to get started."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Expense
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={expenses as ExpenseRow[]}
            filterKeys={["description", "category.name", "employee.firstName", "status"]}
            searchPlaceholder="Search expenses…"
            emptyMessage="No expenses match your search"
            pageSize={10}
          />
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-3 font-semibold">Expense categories</h3>
          <ul className="space-y-2">
            {categories.length === 0 && (
              <li className="text-sm text-muted-foreground">No categories yet.</li>
            )}
            {categories.map((c: { id: string; name: string; accountId: string | null }) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span>{c.name}</span>
                <Badge variant="secondary">{c.accountId ? "mapped" : "unmapped"}</Badge>
              </li>
            ))}
          </ul>
          <form onSubmit={addCategory} className="mt-4 flex gap-2">
            <Input name="name" placeholder="New category name" required />
            <Button type="submit" variant="outline">
              Add
            </Button>
          </form>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Expense</DialogTitle>
            <DialogDescription>Expenses require approval before they are booked and paid.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employee (claimant)</Label>
                <Select value={employeeId || undefined} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Company expense" />
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
              <div className="space-y-2">
                <Label>Reimburse via</Label>
                <Select value={employeeId ? reimbursementMethod : undefined} onValueChange={setReimbursementMethod} disabled={!employeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder={employeeId ? "Select method" : "Select claimant first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank / Cash</SelectItem>
                    <SelectItem value="payroll">Payroll (net pay top-up)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId || undefined} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c: { id: string; name: string }) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Select value={vendorId || undefined} onValueChange={setVendorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v: { id: string; name: string }) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Submitting…" : "Submit expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={payBankId !== null} onOpenChange={(o) => !o && setPayBankId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay Expense by Bank</DialogTitle>
            <DialogDescription>Records a payment journal (Dr payable, Cr payroll clearing).</DialogDescription>
          </DialogHeader>
          <form onSubmit={payBank} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pay-date">Payment date</Label>
                <Input id="pay-date" name="date" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-ref">Reference</Label>
                <Input id="pay-ref" name="reference" placeholder="e.g. TRF-1001" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayBankId(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Paying…" : "Confirm payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={payRun !== null} onOpenChange={(o) => !o && setPayRun(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay via Payroll</DialogTitle>
            <DialogDescription>
              Attach this claim to an open payroll run. It becomes a net-pay top-up and clears the
              reimbursement payable when the run&apos;s journal is posted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {payRun?.payrollRunId ? (
              <p className="text-sm text-muted-foreground">
                This claim is attached to a payroll run. You can detach it to choose a different run (only if the run is not yet approved).
              </p>
            ) : (
              <div className="space-y-2">
                <Label>Payroll run (draft/submitted)</Label>
                <Select value={selectedRun || undefined} onValueChange={setSelectedRun}>
                  <SelectTrigger>
                    <SelectValue placeholder={allRuns.length ? "Select run" : "No open runs"} />
                  </SelectTrigger>
                  <SelectContent>
                    {allRuns.map((run) => (
                      <SelectItem key={run.id} value={run.id}>
                        {run.period.name} ({run.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter className="flex justify-between gap-2 sm:justify-end">
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setPayRun(null)}>
                  Cancel
                </Button>
                {payRun?.payrollRunId ? (
                  <Button type="button" variant="destructive" disabled={saving} onClick={detachRun}>
                    Detach
                  </Button>
                ) : (
                  <Button type="button" disabled={saving || !selectedRun} onClick={attachRun}>
                    Attach to run
                  </Button>
                )}
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}