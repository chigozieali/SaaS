"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const fmt = (n: string | number) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

type Grade = {
  id: string;
  name: string;
  description: string | null;
  minAmount: string | number;
  maxAmount: string | number;
  isActive: boolean;
};

export function SalaryGradesClient({ canEdit }: { canEdit: boolean }) {
  const { data, mutate } = useSWR("/api/hr/salary-grades", fetcher);
  const grades: Grade[] = data?.grades ?? [];
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", minAmount: "", maxAmount: "" });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/hr/salary-grades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        minAmount: Number(form.minAmount),
        maxAmount: Number(form.maxAmount),
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Salary grade created");
      setForm({ name: "", description: "", minAmount: "", maxAmount: "" });
      setOpen(false);
      mutate();
    } else {
      const d = await res.json().catch(() => null);
      toast.error(d?.message ?? "Failed to create grade");
    }
  }

  async function toggleActive(grade: Grade) {
    const res = await fetch(`/api/hr/salary-grades?id=${grade.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !grade.isActive }),
    });
    if (res.ok) {
      toast.success(grade.isActive ? "Grade deactivated" : "Grade activated");
      mutate();
    } else {
      toast.error("Failed to update grade");
    }
  }

  const columns: ColumnDef<Grade>[] = [
    { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.description || "—"}</span>,
    },
    {
      accessorKey: "minAmount",
      header: "Min",
      cell: ({ row }) => <span>{fmt(row.original.minAmount)}</span>,
    },
    {
      accessorKey: "maxAmount",
      header: "Max",
      cell: ({ row }) => <span>{fmt(row.original.maxAmount)}</span>,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "secondary"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) =>
        canEdit ? (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => toggleActive(row.original)}>
              {row.original.isActive ? "Deactivate" : "Activate"}
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader title="Salary Grades" description="Define pay bands for compensation structure and promotion cycles.">
        {canEdit && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Grade
          </Button>
        )}
      </PageHeader>

      {grades.length === 0 ? (
        <EmptyState
          title="No salary grades"
          description="Create pay bands so employees can be assigned a grade."
          action={
            canEdit ? (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> New Grade
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable columns={columns} data={grades} filterKeys={["name"]} emptyMessage="No grades match" pageSize={10} />
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Salary Grade</DialogTitle>
            <DialogDescription>Pay band used to classify employees by compensation level.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grade-name">Name</Label>
              <Input id="grade-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade-desc">Description</Label>
              <Input id="grade-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="grade-min">Minimum (annual)</Label>
                <Input id="grade-min" type="number" min="0" step="0.01" value={form.minAmount} onChange={(e) => setForm((f) => ({ ...f, minAmount: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade-max">Maximum (annual)</Label>
                <Input id="grade-max" type="number" min="0" step="0.01" value={form.maxAmount} onChange={(e) => setForm((f) => ({ ...f, maxAmount: e.target.value }))} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create grade"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}