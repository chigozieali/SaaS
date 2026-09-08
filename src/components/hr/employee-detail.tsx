"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DetailField, DetailGrid } from "@/components/modules/detail-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export type EmployeeRow = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  department?: { id: string; name: string } | null;
  position?: { id: string; title: string } | null;
  manager?: { id: string; firstName: string; lastName: string } | null;
  hireDate?: string | null;
  employmentType?: string;
  status?: string;
  isActive: boolean;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  tin?: string | null;
  ssn?: string | null;
  salaryStructures?: Array<{
    id: string;
    basicSalary: string | number;
    allowances: Record<string, number> | null;
    effectiveFrom: string;
    isActive: boolean;
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: EmployeeRow | null;
  managers: EmployeeRow[];
  canEdit: boolean;
  onUpdated: (employee?: EmployeeRow) => void;
};

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  departmentId: "",
  positionId: "",
  managerId: "",
  employmentType: "permanent",
  hireDate: "",
  bankName: "",
  bankAccountNumber: "",
  bankAccountName: "",
  tin: "",
};

const fmt = (n: string | number) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

export function EmployeeDetail({ open, onOpenChange, employee, managers, canEdit, onUpdated }: Props) {
  const { data: deptData } = useSWR("/api/hr/departments", fetcher);
  const { data: posData } = useSWR("/api/hr/positions", fetcher);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const departments = deptData?.departments ?? [];
  const positions = posData?.positions ?? [];
  const managerOptions = useMemo(
    () =>
      managers.filter(
        (m) => m.id !== employee?.id && m.id !== undefined
      ).map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName}` })),
    [managers, employee]
  );
  const activeSalary = employee?.salaryStructures?.[0];
  const allowances =
    activeSalary && typeof activeSalary.allowances === "object" && activeSalary.allowances
      ? (activeSalary.allowances as Record<string, number>)
      : null;

  useEffect(() => {
    setMode("view");
    if (employee) {
      setForm({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email ?? "",
        phone: employee.phone ?? "",
        departmentId: employee.department?.id ?? "",
        positionId: employee.position?.id ?? "",
        managerId: employee.manager?.id ?? "",
        employmentType: employee.employmentType ?? "permanent",
        hireDate: employee.hireDate ? employee.hireDate.slice(0, 10) : "",
        bankName: employee.bankName ?? "",
        bankAccountNumber: employee.bankAccountNumber ?? "",
        bankAccountName: employee.bankAccountName ?? "",
        tin: employee.tin ?? "",
      });
    }
  }, [open, employee]);

  if (!employee) return null;
  const record = employee;

  const update =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/hr/employees/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        departmentId: form.departmentId || null,
        positionId: form.positionId || null,
        managerId: form.managerId || null,
        employmentType: form.employmentType,
        hireDate: form.hireDate || null,
        bankName: form.bankName || undefined,
        bankAccountNumber: form.bankAccountNumber || undefined,
        bankAccountName: form.bankAccountName || undefined,
        tin: form.tin || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      toast.success("Employee updated");
      onUpdated(data.employee);
      setMode("view");
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to update employee");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {employee.firstName} {employee.lastName}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">{employee.employeeCode}</DialogDescription>
        </DialogHeader>

        {mode === "view" ? (
          <div className="space-y-6">
            <DetailGrid>
              <DetailField label="Status">
                <Badge variant={employee.isActive ? "success" : "destructive"}>
                  {employee.isActive ? "Active" : "Inactive"}
                </Badge>
              </DetailField>
              <DetailField label="Employment type">{employee.employmentType ?? "—"}</DetailField>
              <DetailField label="Department">{employee.department?.name ?? "—"}</DetailField>
              <DetailField label="Position">{employee.position?.title ?? "—"}</DetailField>
              <DetailField label="Manager">
                {employee.manager
                  ? `${employee.manager.firstName} ${employee.manager.lastName}`
                  : "—"}
              </DetailField>
              <DetailField label="Hire date">{employee.hireDate ? employee.hireDate.slice(0, 10) : "—"}</DetailField>
              <DetailField label="Email">{employee.email || "—"}</DetailField>
              <DetailField label="Phone">{employee.phone || "—"}</DetailField>
            </DetailGrid>

            <div>
              <h4 className="mb-2 text-sm font-semibold">Bank & Tax Details</h4>
              <DetailGrid>
                <DetailField label="Bank name">{employee.bankName || "—"}</DetailField>
                <DetailField label="Account number">{employee.bankAccountNumber || "—"}</DetailField>
                <DetailField label="Account name">{employee.bankAccountName || "—"}</DetailField>
                <DetailField label="TIN">{employee.tin || "—"}</DetailField>
              </DetailGrid>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">Active Salary</h4>
              {activeSalary ? (
                <DetailGrid>
                  <DetailField label="Basic salary">{fmt(activeSalary.basicSalary)}</DetailField>
                  <DetailField label="Effective from">{activeSalary.effectiveFrom.slice(0, 10)}</DetailField>
                  {allowances && Object.keys(allowances).length > 0 && (
                    <DetailField label="Allowances" full>
                      {Object.entries(allowances)
                        .map(([name, amount]) => `${name}: ${fmt(amount)}`)
                        .join(", ")}
                    </DetailField>
                  )}
                </DetailGrid>
              ) : (
                <p className="text-sm text-muted-foreground">No salary structure set.</p>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">First name</Label>
                <Input id="edit-firstName" value={form.firstName} onChange={update("firstName")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Last name</Label>
                <Input id="edit-lastName" value={form.lastName} onChange={update("lastName")} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" value={form.email} onChange={update("email")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input id="edit-phone" value={form.phone} onChange={update("phone")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={form.departmentId || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d: { id: string; name: string }) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Position</Label>
                <Select
                  value={form.positionId || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, positionId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map((p: { id: string; title: string }) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Manager</Label>
                <Select
                  value={form.managerId || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, managerId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managerOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employment type</Label>
                <Select
                  value={form.employmentType}
                  onValueChange={(v) => setForm((f) => ({ ...f, employmentType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["permanent", "contract", "part-time", "intern", "probation"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-hireDate">Hire date</Label>
                <Input id="edit-hireDate" type="date" value={form.hireDate} onChange={update("hireDate")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-bankName">Bank name</Label>
                <Input id="edit-bankName" value={form.bankName} onChange={update("bankName")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bankAccountNumber">Account number</Label>
                <Input id="edit-bankAccountNumber" value={form.bankAccountNumber} onChange={update("bankAccountNumber")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-bankAccountName">Account name</Label>
                <Input id="edit-bankAccountName" value={form.bankAccountName} onChange={update("bankAccountName")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tin">TIN</Label>
                <Input id="edit-tin" value={form.tin} onChange={update("tin")} />
              </div>
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
            {canEdit && <Button onClick={() => setMode("edit")}>Edit</Button>}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}