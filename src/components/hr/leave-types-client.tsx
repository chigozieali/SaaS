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
import { Switch } from "@/components/ui/switch";
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

type LeaveType = {
  id: string;
  name: string;
  daysAllowed: number;
  isPaid: boolean;
  accrualPerMonth: string | number | null;
  carryoverMax: string | number | null;
};

export function LeaveTypesClient({ canEdit }: { canEdit: boolean }) {
  const { data, mutate } = useSWR("/api/hr/leave-types", fetcher);
  const types: LeaveType[] = data?.leaveTypes ?? [];
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    daysAllowed: "",
    isPaid: true,
    accrualPerMonth: "",
    carryoverMax: "",
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/hr/leave-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        daysAllowed: Number(form.daysAllowed),
        isPaid: form.isPaid,
        accrualPerMonth: form.accrualPerMonth ? Number(form.accrualPerMonth) : null,
        carryoverMax: form.carryoverMax ? Number(form.carryoverMax) : 0,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Leave type created");
      setForm({ name: "", daysAllowed: "", isPaid: true, accrualPerMonth: "", carryoverMax: "" });
      setOpen(false);
      mutate();
    } else {
      const d = await res.json().catch(() => null);
      toast.error(d?.message ?? "Failed to create leave type");
    }
  }

  const columns: ColumnDef<LeaveType>[] = [
    { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    {
      accessorKey: "daysAllowed",
      header: "Annual days",
      cell: ({ row }) => <span>{row.original.daysAllowed}</span>,
    },
    {
      accessorKey: "isPaid",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant={row.original.isPaid ? "success" : "secondary"}>
          {row.original.isPaid ? "Paid" : "Unpaid"}
        </Badge>
      ),
    },
    {
      accessorKey: "accrualPerMonth",
      header: "Accrual / month",
      cell: ({ row }) => <span>{row.original.accrualPerMonth != null ? row.original.accrualPerMonth : "—"}</span>,
    },
    {
      accessorKey: "carryoverMax",
      header: "Max carryover",
      cell: ({ row }) => <span>{row.original.carryoverMax != null ? row.original.carryoverMax : 0}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Leave Types" description="Configure leave policies, entitlements, accrual and carryover.">
        {canEdit && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Leave Type
          </Button>
        )}
      </PageHeader>

      {types.length === 0 ? (
        <EmptyState
          title="No leave types"
          description="Create leave categories such as annual, sick or unpaid leave."
          action={
            canEdit ? (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> New Leave Type
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable columns={columns} data={types} filterKeys={["name"]} emptyMessage="No leave types match" pageSize={10} />
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Leave Type</DialogTitle>
            <DialogDescription>
              Entitlement is fixed per year, or accrued monthly if accrual is set. Unpaid leave is deducted from pay.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="lt-name">Name</Label>
                <Input id="lt-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lt-days">Annual days allowed</Label>
                <Input id="lt-days" type="number" min="1" value={form.daysAllowed} onChange={(e) => setForm((f) => ({ ...f, daysAllowed: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lt-accrual">Accrual per month (optional)</Label>
                <Input id="lt-accrual" type="number" min="0" step="0.01" value={form.accrualPerMonth} onChange={(e) => setForm((f) => ({ ...f, accrualPerMonth: e.target.value }))} placeholder="e.g. 1.5" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lt-carry">Max days carryover</Label>
                <Input id="lt-carry" type="number" min="0" value={form.carryoverMax} onChange={(e) => setForm((f) => ({ ...f, carryoverMax: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2 space-y-0">
              <Switch id="lt-paid" checked={form.isPaid} onCheckedChange={(v) => setForm((f) => ({ ...f, isPaid: v }))} />
              <Label htmlFor="lt-paid">Paid leave (unpaid leave reduces net pay)</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create leave type"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}