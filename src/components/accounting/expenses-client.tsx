"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus } from "lucide-react";
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
const badgeVariant: Record<string, "warning" | "success" | "destructive" | "info" | "outline"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "outline",
};

export function ExpensesClient() {
  const { data, mutate } = useSWR("/api/accounting/expenses", fetcher);
  const { data: vendorData } = useSWR("/api/accounting/vendors", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [vendorId, setVendorId] = useState("");

  const expenses = data?.expenses ?? [];
  const categories = data?.categories ?? [];
  const vendors = vendorData?.vendors ?? [];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      categoryId: categoryId || null,
      vendorId: vendorId || null,
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
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to submit expense");
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
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to update expense");
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
      <PageHeader title="Expenses" description="Submit, review and approve expense reimbursements.">
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
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e: Record<string, any>) => (
                <TableRow key={e.id}>
                  <TableCell>{new Date(e.date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{e.description ?? "—"}</TableCell>
                  <TableCell>{e.category?.name ?? "—"}</TableCell>
                  <TableCell>{e.vendor?.name ?? "—"}</TableCell>
                  <TableCell className="text-right">{Number(e.amount).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant[e.status] ?? "outline"}>{e.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {e.status === "pending" && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" className="h-7" onClick={() => decide(e.id, "approved")}>
                          Approve
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => decide(e.id, "rejected")}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-3 font-semibold">Expense categories</h3>
          <ul className="space-y-2">
            {categories.length === 0 && (
              <li className="text-sm text-muted-foreground">No categories yet.</li>
            )}
            {categories.map((c: Record<string, any>) => (
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
            <DialogDescription>Expenses require approval before they are posted.</DialogDescription>
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
                    <SelectValue placeholder="Select vendor" />
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
    </div>
  );
}