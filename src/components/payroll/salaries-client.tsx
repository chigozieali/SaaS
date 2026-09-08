"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type AllowanceRow = { name: string; amount: string };

export function SalariesClient() {
  const { data, mutate } = useSWR("/api/payroll/salaries", fetcher);
  const { data: empData } = useSWR("/api/hr/employees", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [allowances, setAllowances] = useState<AllowanceRow[]>([
    { name: "Housing", amount: "" },
    { name: "Transport", amount: "" },
  ]);

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

  const totalIncome = (s: Record<string, any>) => {
    const allowances = (s.allowances ?? {}) as Record<string, number>;
    return Number(s.basicSalary) + Object.values(allowances).reduce((a, b) => a + Number(b), 0);
  };

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
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Basic</TableHead>
                <TableHead>Allowances</TableHead>
                <TableHead>Total income</TableHead>
                <TableHead>Effective from</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {structures.map((s: Record<string, any>) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.employee.firstName} {s.employee.lastName}
                  </TableCell>
                  <TableCell>{Number(s.basicSalary).toLocaleString()}</TableCell>
                  <TableCell>
                    {Object.keys(s.allowances ?? {}).length
                      ? Object.entries(s.allowances as Record<string, number>)
                          .map(([name, amount]) => `${name}: ${Number(amount).toLocaleString()}`)
                          .join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell className="font-medium">{totalIncome(s).toLocaleString()}</TableCell>
                  <TableCell>{new Date(s.effectiveFrom).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? "success" : "outline"}>
                      {s.isActive ? "Active" : "Historic"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
    </div>
  );
}