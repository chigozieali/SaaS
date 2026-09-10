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
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/ui/data-table";
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
const fmt = (n: string | number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

type Plan = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  requiresConfirmation: boolean;
  employerSharePct: string | number | null;
  employeeSharePct: string | number | null;
  premium: string | number | null;
  isActive: boolean;
};

export function BenefitPlansClient({ canEdit }: { canEdit: boolean }) {
  const { data, mutate } = useSWR("/api/hr/benefit-plans", fetcher);
  const plans: Plan[] = data?.plans ?? [];
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "hmo",
    description: "",
    requiresConfirmation: false,
    employerSharePct: "",
    employeeSharePct: "",
    premium: "",
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/hr/benefit-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        description: form.description || undefined,
        requiresConfirmation: form.requiresConfirmation,
        employerSharePct: form.employerSharePct ? Number(form.employerSharePct) : null,
        employeeSharePct: form.employeeSharePct ? Number(form.employeeSharePct) : null,
        premium: form.premium ? Number(form.premium) : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Benefit plan created");
      setForm({ name: "", type: "hmo", description: "", requiresConfirmation: false, employerSharePct: "", employeeSharePct: "", premium: "" });
      setOpen(false);
      mutate();
    } else {
      const d = await res.json().catch(() => null);
      toast.error(d?.message ?? "Failed to create plan");
    }
  }

  async function toggleActive(plan: Plan) {
    const res = await fetch(`/api/hr/benefit-plans?id=${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !plan.isActive }),
    });
    if (res.ok) {
      toast.success(plan.isActive ? "Plan deactivated" : "Plan activated");
      mutate();
    } else {
      toast.error("Failed to update plan");
    }
  }

  const columns: ColumnDef<Plan>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          {row.original.description ? (
            <div className="text-xs text-muted-foreground">{row.original.description}</div>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <Badge variant="secondary">{row.original.type}</Badge>,
    },
    {
      accessorKey: "requiresConfirmation",
      header: "Eligibility",
      cell: ({ row }) => (
        <span className="text-xs">{row.original.requiresConfirmation ? "Confirmed staff only" : "All staff"}</span>
      ),
    },
    {
      accessorKey: "premium",
      header: "Monthly premium",
      cell: ({ row }) => <span>{fmt(row.original.premium)}</span>,
    },
    {
      accessorKey: "employerSharePct",
      header: "Employer / Employee",
      cell: ({ row }) => (
        <span className="text-xs">
          {fmt(row.original.employerSharePct)}% / {fmt(row.original.employeeSharePct)}%
        </span>
      ),
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
      <PageHeader title="Benefit Plans" description="Configure employee benefit plans such as HMO coverage.">
        {canEdit && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New Plan
          </Button>
        )}
      </PageHeader>

      {plans.length === 0 ? (
        <EmptyState
          title="No benefit plans"
          description="Create benefit plans (e.g. HMO tiers) to offer to employees."
          action={
            canEdit ? (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> New Plan
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable columns={columns} data={plans} filterKeys={["name"]} emptyMessage="No plans match" pageSize={10} />
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Benefit Plan</DialogTitle>
            <DialogDescription>Shares are treated as monthly amounts for payroll contribution calculations.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bp-name">Name</Label>
                <Input id="bp-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["hmo", "nhis", "pension", "other"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bp-desc">Description</Label>
              <Textarea id="bp-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bp-premium">Monthly premium</Label>
                <Input id="bp-premium" type="number" min="0" step="0.01" value={form.premium} onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-emp">Employer share %</Label>
                <Input id="bp-emp" type="number" min="0" max="100" step="0.01" value={form.employerSharePct} onChange={(e) => setForm((f) => ({ ...f, employerSharePct: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bp-employee">Employee share %</Label>
                <Input id="bp-employee" type="number" min="0" max="100" step="0.01" value={form.employeeSharePct} onChange={(e) => setForm((f) => ({ ...f, employeeSharePct: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2 space-y-0">
              <Switch id="bp-conf" checked={form.requiresConfirmation} onCheckedChange={(v) => setForm((f) => ({ ...f, requiresConfirmation: v }))} />
              <Label htmlFor="bp-conf">Only eligible for confirmed (permanent) staff</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create plan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}