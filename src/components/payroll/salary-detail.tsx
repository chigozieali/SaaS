"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DetailField, DetailGrid } from "@/components/modules/detail-field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SalaryStructureRow = {
  id: string;
  basicSalary: string | number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  allowances: Record<string, number> | null;
  employee: { id: string; firstName: string; lastName: string; employeeCode: string };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  structure: SalaryStructureRow | null;
  canEdit: boolean;
  onUpdated: (structure?: SalaryStructureRow) => void;
};

type AllowanceRow = { name: string; amount: string };

const fmt = (n: string | number) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

export function SalaryDetail({ open, onOpenChange, structure, canEdit, onUpdated }: Props) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [saving, setSaving] = useState(false);
  const [basicSalary, setBasicSalary] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [allowances, setAllowances] = useState<AllowanceRow[]>([]);

  useEffect(() => {
    setMode("view");
    if (structure) {
      setBasicSalary(String(Number(structure.basicSalary) || 0));
      setEffectiveFrom(structure.effectiveFrom ? structure.effectiveFrom.slice(0, 10) : "");
      setAllowances(
        Object.entries(structure.allowances ?? {}).map(([name, amount]) => ({
          name,
          amount: String(Number(amount) || 0),
        }))
      );
    }
  }, [open, structure]);

  if (!structure) return null;
  const record = structure;

  const totalIncome =
    Number(record.basicSalary) +
    Object.values(record.allowances ?? {}).reduce((a, b) => a + Number(b), 0);

  function setAllowance(idx: number, patch: Partial<AllowanceRow>) {
    setAllowances((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function addAllowance() {
    setAllowances((prev) => [...prev, { name: "", amount: "" }]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const allowanceMap: Record<string, number> = {};
    for (const row of allowances) {
      if (row.name.trim() && row.amount) {
        allowanceMap[row.name.trim()] = Number(row.amount);
      }
    }
    setSaving(true);
    const res = await fetch(`/api/payroll/salaries/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        basicSalary: Number(basicSalary),
        effectiveFrom,
        ...(Object.keys(allowanceMap).length ? { allowances: allowanceMap } : { allowances: {} }),
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      toast.success("Salary structure updated");
      onUpdated(data.structure);
      setMode("view");
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to update salary structure");
    }
  }

  const allowancesList = Object.entries(structure.allowances ?? {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {structure.employee.firstName} {structure.employee.lastName}
          </DialogTitle>
        </DialogHeader>

        {mode === "view" ? (
          <DetailGrid>
            <DetailField label="Status">
              <Badge variant={structure.isActive ? "success" : "outline"}>
                {structure.isActive ? "Active" : "Historic"}
              </Badge>
            </DetailField>
            <DetailField label="Employee code">
              <span className="font-mono text-xs">{structure.employee.employeeCode}</span>
            </DetailField>
            <DetailField label="Basic salary">{fmt(structure.basicSalary)}</DetailField>
            <DetailField label="Total income">{fmt(totalIncome)}</DetailField>
            <DetailField label="Effective from">
              {structure.effectiveFrom.slice(0, 10)}
            </DetailField>
            <DetailField label="Effective to">
              {structure.effectiveTo ? structure.effectiveTo.slice(0, 10) : "—"}
            </DetailField>
            <DetailField label="Allowances" full>
              {allowancesList.length > 0 ? (
                <ul className="space-y-0.5">
                  {allowancesList.map(([name, amount]) => (
                    <li key={name} className="flex justify-between gap-4">
                      <span>{name}</span>
                      <span className="font-mono">{fmt(amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                "—"
              )}
            </DetailField>
          </DetailGrid>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-basicSalary">Monthly basic</Label>
                <Input
                  id="edit-basicSalary"
                  type="number"
                  step="0.01"
                  value={basicSalary}
                  onChange={(e) => setBasicSalary(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-effectiveFrom">Effective from</Label>
                <Input
                  id="edit-effectiveFrom"
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  required
                />
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
                  <Button type="button" variant="ghost" size="icon" onClick={() => setAllowances((prev) => prev.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMode("view")}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {mode === "view" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {canEdit && structure.isActive && <Button onClick={() => setMode("edit")}>Edit</Button>}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}