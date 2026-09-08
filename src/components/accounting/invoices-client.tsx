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
  draft: "outline",
  sent: "info",
  partial: "warning",
  paid: "success",
  overdue: "destructive",
  cancelled: "outline",
};

type Item = { description: string; quantity: string; unitPrice: string };

export function InvoicesClient() {
  const { data, mutate } = useSWR("/api/accounting/invoices", fetcher);
  const { data: custData } = useSWR("/api/accounting/customers", fetcher);
  const [createOpen, setCreateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: "1", unitPrice: "" }]);

  const invoices = data?.invoices ?? [];
  const customers = custData?.customers ?? [];

  function setItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function createInvoice(e: React.FormEvent<HTMLFormElement>) {
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
      customerId,
      issueDate: formData.get("issueDate"),
      dueDate: (formData.get("dueDate") as string) || undefined,
      discount: Number(formData.get("discount") ?? 0),
      notes: (formData.get("notes") as string) || undefined,
      lines,
    };

    setSaving(true);
    const res = await fetch("/api/accounting/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Invoice created");
      mutate();
      setCreateOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to create invoice");
    }
  }

  async function recordPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payInvoice) return;
    const formData = new FormData(e.currentTarget);
    const payload = {
      invoiceId: payInvoice.id,
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
      setPayInvoice(null);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to record payment");
    }
  }

  return (
    <div>
      <PageHeader title="Invoices" description="Create and track invoices to customers.">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Invoice
        </Button>
      </PageHeader>

      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Create invoices to bill your customers."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Invoice
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Issue date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv: Record<string, any>) => {
                const paid = inv.payments.reduce((s: number, p: any) => s + Number(p.amount), 0);
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell className="font-medium">{inv.customer.name}</TableCell>
                    <TableCell>{new Date(inv.issueDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">{Number(inv.total).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{paid.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant[inv.status] ?? "outline"}>{inv.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.status !== "paid" && inv.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => {
                            setPayInvoice(inv);
                            setPayOpen(true);
                          }}
                        >
                          <Banknote className="h-3 w-3" /> Record payment
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
            <DialogTitle>New Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={createInvoice} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={customerId || undefined} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c: { id: string; name: string }) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
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
                    placeholder="Service description"
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
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount">Discount</Label>
                <Input id="discount" name="discount" type="number" step="0.01" defaultValue="0" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create invoice"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {payInvoice
                ? `${payInvoice.invoiceNumber} · outstanding ${(
                    Number(payInvoice.total) - payInvoice.payments.reduce((s: number, p: any) => s + Number(p.amount), 0)
                  ).toLocaleString()}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={recordPayment} className="space-y-4">
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