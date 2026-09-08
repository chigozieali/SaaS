"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus, Trash2, Banknote } from "lucide-react";
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
  unpaid: "warning",
  partial: "info",
  paid: "success",
  overdue: "destructive",
  cancelled: "outline",
};

type Item = { description: string; quantity: string; unitPrice: string };

export function BillsClient() {
  const { data, mutate } = useSWR("/api/accounting/bills", fetcher);
  const { data: vendorData } = useSWR("/api/accounting/vendors", fetcher);
  const [createOpen, setCreateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payBill, setPayBill] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: "1", unitPrice: "" }]);

  const bills = data?.bills ?? [];
  const vendors = vendorData?.vendors ?? [];

  function setItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function createBill(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const lines = items
      .filter((l) => l.description && l.unitPrice !== "")
      .map((l) => ({
        description: l.description,
        quantity: Number(l.quantity || 1),
        unitPrice: Number(l.unitPrice),
      }));

    const payload = {
      vendorId,
      issueDate: formData.get("issueDate"),
      dueDate: (formData.get("dueDate") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
      lines,
    };

    setSaving(true);
    const res = await fetch("/api/accounting/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Bill created");
      mutate();
      setCreateOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to create bill");
    }
  }

  async function payBillSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payBill) return;
    const formData = new FormData(e.currentTarget);
    const payload = {
      billId: payBill.id,
      amount: Number(formData.get("amount")),
      method: "bank",
      reference: (formData.get("reference") as string) || undefined,
      date: (formData.get("date") as string) || undefined,
    };
    setSaving(true);
    const res = await fetch("/api/accounting/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Payment recorded");
      mutate();
      setPayOpen(false);
      setPayBill(null);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to record payment");
    }
  }

  return (
    <div>
      <PageHeader title="Bills" description="Record and track bills from vendors.">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Bill
        </Button>
      </PageHeader>

      {bills.length === 0 ? (
        <EmptyState
          title="No bills yet"
          description="Record vendor bills to track what you owe."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Bill
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Issue date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill: Record<string, any>) => {
                const paid = bill.payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
                return (
                  <TableRow key={bill.id}>
                    <TableCell className="font-mono text-xs">{bill.billNumber}</TableCell>
                    <TableCell className="font-medium">{bill.vendor.name}</TableCell>
                    <TableCell>{new Date(bill.issueDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">{Number(bill.total).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{paid.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant[bill.status] ?? "outline"}>{bill.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {bill.status !== "paid" && bill.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => {
                            setPayBill(bill);
                            setPayOpen(true);
                          }}
                        >
                          <Banknote className="h-3 w-3" /> Make payment
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Bill</DialogTitle>
          </DialogHeader>
          <form onSubmit={createBill} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="issueDate">Issue date</Label>
                <Input id="issueDate" name="issueDate" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" name="dueDate" type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line items</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setItems((prev) => [...prev, { description: "", quantity: "1", unitPrice: "" }])}
                >
                  <Plus className="h-3 w-3" /> Add item
                </Button>
              </div>
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                <span className="col-span-6">Description</span>
                <span className="col-span-2">Qty</span>
                <span className="col-span-2">Unit price</span>
                <span className="col-span-2" />
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 items-center gap-2">
                  <Input
                    className="col-span-6"
                    placeholder="Item description"
                    value={item.description}
                    onChange={(e) => setItem(idx, { description: e.target.value })}
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    value={item.quantity}
                    onChange={(e) => setItem(idx, { quantity: e.target.value })}
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={item.unitPrice}
                    onChange={(e) => setItem(idx, { unitPrice: e.target.value })}
                  />
                  <Button
                    className="col-span-2"
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={items.length <= 1}
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create bill"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay Bill</DialogTitle>
            <DialogDescription>
              {payBill
                ? `${payBill.billNumber} · outstanding ${(
                    Number(payBill.total) - payBill.payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
                  ).toLocaleString()}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={payBillSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" name="amount" type="number" step="0.01" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Reference (optional)</Label>
              <Input id="reference" name="reference" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Recording…" : "Record payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}