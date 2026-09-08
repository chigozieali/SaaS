"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus, Trash2, Eye } from "lucide-react";
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
import { SalaryDetail, type SalaryStructureRow } from "@/components/payroll/salary-detail";
import { hasPermission } from "@/lib/client-permissions";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type AllowanceRow = { name: string; amount: string };

export function SalariesClient({ permissions }: { permissions?: Set<string> }) {
  const { data, mutate } = useSWR("/api/payroll/salaries", fetcher);
  const { data: empData } = useSWR("/api/hr/employees", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [allowances, setAllowances] = useState<AllowanceRow[]>([
    { name: "Housing", amount: "" },
    { name: "Transport", amount: "" },
  ]);
  const [selected, setSelected] = useState<SalaryStructureRow | null>(null);
  const canEdit = hasPermission(permissions, "payroll.configure");

  const structures = data?.structures ?? [];
  const employees = (empData?.employees ?? []).filter((e: Record<string, any>) => e.isActive);

  function setAllowance(idx: number, patch: Partial<AllowanceRow>) {
    setAllowances((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function addAllowance() {
    setAllowances((prev) => [...prev, { name: "", amount: "" }]);
  }

  function removeAllowance(idx: number) {
    setAllowances((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const allowanceMap: Record<string, number> = {};
    for (const row of allowances) {
      if (row.name.trim() && row.amount) {
        allowanceMap[row.name.trim()] = Number(row.amount);
      }
    }
    const payload = {
      employeeId,
      basicSalary: Number(formData.get("basicSalary")),
      allowances: Object.keys(allowanceMap).length ? allowanceMap : undefined,
      effectiveFrom: formData.get("effectiveFrom"),
    };

    setSaving(true);
    const res = await fetch("/api/payroll/salaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Salary structure saved");
      mutate();
      setOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to save salary");
    }
  }

  const totalIncome = (s: SalaryStructureRow) => {
    const allowances = (s.allowances ?? {}) as Record<string, number>;
    return Number(s.basicSalary) + Object.values(allowances).reduce((a, b) => a + Number(b), 0);
  };

  const columns: ColumnDef<SalaryStructureRow>[] = [
    {
      accessorFn: (s) => `${s.employee.firstName} ${s.employee.lastName}`,
      id: "employee",
      header: "Employee",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.employee.firstName} {row.original.employee.lastName}
        </span>
      ),
    },
    {
      accessorFn: (s) => Number(s.basicSalary),
      id: "basic",
      header: "Basic",
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => <span>{Number(row.original.basicSalary).toLocaleString()}</span>,
    },
    {
      accessorFn: (s) =>
        Object.keys(s.allowances ?? {}).length
          ? Object.entries(s.allowances ?? {})
              .map(([name, amount]) => `${name}: ${Number(amount).toLocaleString()}`)
              .join(", ")
          : "",
      id: "allowances",
      header: "Allowances",
      cell: ({ row }) => {
        const a = row.original.allowances ?? {};
        return Object.keys(a).length
          ? Object.entries(a)
              .map(([name, amount]) => `${name}: ${Number(amount).toLocaleString()}`)
              .join(", ")
          : "—";
      },
    },
    {
      accessorFn: (s) => totalIncome(s),
      id: "total",
      header: "Total income",
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => <span className="font-medium">{totalIncome(row.original).toLocaleString()}</span>,
    },
    {
      accessorFn: (s) => new Date(s.effectiveFrom).getTime(),
      id: "effectiveFrom",
      header: "Effective from",
      cell: ({ row }) => <span>{new Date(row.original.effectiveFrom).toLocaleDateString()}</span>,
    },
    {
      accessorFn: (s) => (s.isActive ? "Active" : "Historic"),
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "outline"}>
          {row.original.isActive ? "Active" : "Historic"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      size: 44,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSelected(row.original)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Salaries" description="Set employee salary structures (versioned per effective date).">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Salary
        </Button>
      </PageHeader>

      {structures.length === 0 ? (
        <EmptyState
          title="No salary structures"
          description="Assign salaries to employees to enable payroll runs."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Salary
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={structures as SalaryStructureRow[]}
            filterKeys={["employee.firstName", "employee.lastName"]}
            searchPlaceholder="Search salary structures…"
            emptyMessage="No salary structures match your search"
            pageSize={10}
          />
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Salary Structure</DialogTitle>
            <DialogDescription>Assigning a salary will supersede any active structure for this employee.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={employeeId || undefined} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e: { id: string; firstName: string; lastName: string }) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="basicSalary">Monthly basic</Label>
                <Input id="basicSalary" name="basicSalary" type="number" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="effectiveFrom">Effective from</Label>
                <Input id="effectiveFrom" name="effectiveFrom" type="date" required />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Allowances</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addAllowance}>
                  <Plus className="h-3 w-3" /> Add row
                </Button>
              </div>
              {allowances.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="Allowance name"
                    value={row.name}
                    onChange={(e) => setAllowance(idx, { name: e.target.value })}
                  />
                  <Input
                    placeholder="Amount"
                    type="number"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => setAllowance(idx, { amount: e.target.value })}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeAllowance(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save salary"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SalaryDetail
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        structure={selected}
        canEdit={canEdit}
        onUpdated={(updated) => {
          mutate();
          if (updated) setSelected((prev) => ({ ...prev, ...updated }));
        }}
      />
    </div>
  );
}