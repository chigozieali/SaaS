"use client";

import useSWR from "swr";
import { useState } from "react";
import { z } from "zod";
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

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  departmentId: z.string().optional().nullable(),
  positionId: z.string().optional().nullable(),
  hireDate: z.string().optional(),
  employmentType: z.string(),
  salaryBasic: z.number().optional(),
});

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EmployeeDialog({ open, onOpenChange, onSaved }: EmployeeDialogProps) {
  const { data: deptData } = useSWR("/api/hr/departments", fetcher);
  const { data: posData } = useSWR("/api/hr/positions", fetcher);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [positionId, setPositionId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const departments = deptData?.departments ?? [];
  const positions = posData?.positions ?? [];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email") ?? "",
      phone: formData.get("phone") ?? "",
      departmentId: departmentId || null,
      positionId: positionId || null,
      hireDate: (formData.get("hireDate") as string) || undefined,
      employmentType: "permanent",
      salaryBasic: formData.get("salaryBasic")
        ? Number(formData.get("salaryBasic"))
        : undefined,
    };

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message ?? "Failed to create employee");
        return;
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hireDate">Hire date</Label>
              <Input id="hireDate" name="hireDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salaryBasic">Monthly basic (optional)</Label>
              <Input id="salaryBasic" name="salaryBasic" type="number" step="0.01" />
            </div>
          </div>
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