"use client";

import useSWR from "swr";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  canPayroll?: boolean;
}

export function EmployeeDialog({ open, onOpenChange, onSaved, canPayroll }: EmployeeDialogProps) {
  const { data: deptData } = useSWR("/api/hr/departments", fetcher);
  const { data: posData } = useSWR("/api/hr/positions", fetcher);
  const { data: gradesData } = useSWR(canPayroll ? "/api/hr/salary-grades" : null, fetcher);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [positionId, setPositionId] = useState<string>("");
  const [salaryGradeId, setSalaryGradeId] = useState<string>("");
  const [employmentType, setEmploymentType] = useState("permanent");
  const [saving, setSaving] = useState(false);

  const departments = deptData?.departments ?? [];
  const positions = posData?.positions ?? [];
  const grades = gradesData?.grades ?? [];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const num = (k: string) => {
      const v = formData.get(k) as string;
      return v ? Number(v) : undefined;
    };
    const payload: Record<string, unknown> = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email") ?? "",
      phone: formData.get("phone") ?? "",
      address: (formData.get("address") as string) || undefined,
      location: (formData.get("location") as string) || undefined,
      dateOfBirth: (formData.get("dateOfBirth") as string) || undefined,
      gender: (formData.get("gender") as string) || undefined,
      maritalStatus: (formData.get("maritalStatus") as string) || undefined,
      nationality: (formData.get("nationality") as string) || undefined,
      nextOfKinName: (formData.get("nextOfKinName") as string) || undefined,
      nextOfKinPhone: (formData.get("nextOfKinPhone") as string) || undefined,
      nextOfKinRelation: (formData.get("nextOfKinRelation") as string) || undefined,
      departmentId: departmentId || null,
      positionId: positionId || null,
      hireDate: (formData.get("hireDate") as string) || undefined,
      employmentType,
      salaryBasic: num("salaryBasic"),
    };
    if (canPayroll) {
      payload.salaryGradeId = salaryGradeId || null;
      payload.bankName = (formData.get("bankName") as string) || undefined;
      payload.bankAccountNumber = (formData.get("bankAccountNumber") as string) || undefined;
      payload.bankAccountName = (formData.get("bankAccountName") as string) || undefined;
      payload.tin = (formData.get("tin") as string) || undefined;
      payload.taxOffice = (formData.get("taxOffice") as string) || undefined;
      payload.pfaName = (formData.get("pfaName") as string) || undefined;
      payload.rsaPin = (formData.get("rsaPin") as string) || undefined;
      payload.pensionPct = num("pensionPct");
      payload.hmoPlan = (formData.get("hmoPlan") as string) || undefined;
      payload.nhiaPct = num("nhiaPct");
      payload.payFrequency = "monthly";
    }

    setSaving(true);
    try {
      const res = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message ?? "Failed to create employee");
        return;
      }
      const data = await res.json().catch(() => null);
      const { account } = data ?? {};
      if (account?.status === "created") {
        toast.success(
          `Employee created. Login: ${account.email} / Password: ${account.password}`,
          { duration: 9000 }
        );
      } else {
        toast.success("Employee created");
      }
      onSaved();
    } catch {
      toast.error("Failed to create employee");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
          <DialogDescription>Record the employee&apos;s personal and employment details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="location">Work location</Label>
              <Input id="location" name="location" placeholder="e.g. Lagos office" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Input id="gender" name="gender" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maritalStatus">Marital status</Label>
              <Input id="maritalStatus" name="maritalStatus" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Input id="nationality" name="nationality" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextOfKinName">Next of kin</Label>
              <Input id="nextOfKinName" name="nextOfKinName" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextOfKinPhone">NOK phone</Label>
              <Input id="nextOfKinPhone" name="nextOfKinPhone" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="nextOfKinRelation">NOK relation</Label>
              <Input id="nextOfKinRelation" name="nextOfKinRelation" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={departmentId || undefined} onValueChange={setDepartmentId}>
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
              <Select value={positionId || undefined} onValueChange={setPositionId}>
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
              <Label>Employment type</Label>
              <Select value={employmentType} onValueChange={setEmploymentType}>
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
              <Label htmlFor="hireDate">Hire date</Label>
              <Input id="hireDate" name="hireDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salaryBasic">Monthly basic (optional)</Label>
              <Input id="salaryBasic" name="salaryBasic" type="number" step="0.01" />
            </div>
            {canPayroll && (
              <div className="space-y-2">
                <Label>Salary grade</Label>
                <Select value={salaryGradeId || undefined} onValueChange={setSalaryGradeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map((g: { id: string; name: string }) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {canPayroll && (
            <div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank name</Label>
                  <Input id="bankName" name="bankName" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankAccountNumber">Account number</Label>
                  <Input id="bankAccountNumber" name="bankAccountNumber" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankAccountName">Account name</Label>
                  <Input id="bankAccountName" name="bankAccountName" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tin">TIN</Label>
                  <Input id="tin" name="tin" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxOffice">Tax office</Label>
                  <Input id="taxOffice" name="taxOffice" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pfaName">PFA name</Label>
                  <Input id="pfaName" name="pfaName" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rsaPin">RSA PIN</Label>
                  <Input id="rsaPin" name="rsaPin" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pensionPct">Pension %</Label>
                  <Input id="pensionPct" name="pensionPct" type="number" min="0" max="100" step="0.01" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hmoPlan">HMO plan</Label>
                  <Input id="hmoPlan" name="hmoPlan" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nhiaPct">NHIA %</Label>
                  <Input id="nhiaPct" name="nhiaPct" type="number" min="0" max="100" step="0.01" />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}