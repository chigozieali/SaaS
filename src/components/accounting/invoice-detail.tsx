"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { DetailField, DetailGrid } from "@/components/modules/detail-field";
import {
  Dialog,
  DialogContent,
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

export type InvoiceLineRow = {
  id: string;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  amount: string | number;
};

export type InvoicePaymentRow = {
  id: string;
  amount: string | number;
  method: string;
  reference: string | null;
  date: string;
};

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: string;
  subtotal: string | number;
  taxAmount: string | number;
  discount: string | number;
  total: string | number;
  amountPaid: string | number;
  notes: string | null;
  customer: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  lines: InvoiceLineRow[];
  payments: InvoicePaymentRow[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceRow | null;
  customers: Array<{ id: string; name: string }>;
  canEdit: boolean;
  onUpdated: (invoice?: InvoiceRow) => void;
};

type Item = { description: string; quantity: string; unitPrice: string };

const badgeVariant: Record<string, "warning" | "success" | "destructive" | "info" | "outline"> = {
  draft: "outline",
  sent: "info",
  partial: "warning",
  paid: "success",
  overdue: "destructive",
  cancelled: "outline",
};

const fmt = (n: string | number) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

export function InvoiceDetail({ open, onOpenChange, invoice, customers, canEdit, onUpdated }: Props) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    setMode("view");
    if (invoice) {
      setCustomerId(invoice.customer?.id ?? "");
      setIssueDate(invoice.issueDate ? invoice.issueDate.slice(0, 10) : "");
      setDueDate(invoice.dueDate ? invoice.dueDate.slice(0, 10) : "");
      setDiscount(String(Number(invoice.discount) || 0));
      setNotes(invoice.notes ?? "");
      setItems(
        invoice.lines.map((l) => ({
          description: l.description,
          quantity: String(Number(l.quantity) || 1),
          unitPrice: String(Number(l.unitPrice) || 0),
        }))
      );
    }
  }, [open, invoice]);

  const editable = !!invoice && invoice.status === "draft";

  const lineColumns: ColumnDef<InvoiceLineRow>[] = useMemo(
    () => [
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => <span className="font-medium">{row.original.description}</span>,
      },
      {
        accessorKey: "quantity",
        header: "Qty",
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
        cell: ({ row }) => <span>{Number(row.original.quantity)}</span>,
      },
      {
        accessorKey: "unitPrice",
        header: "Unit price",
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
        cell: ({ row }) => <span>{fmt(row.original.unitPrice)}</span>,
      },
      {
        accessorKey: "amount",
        header: "Amount",
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
        cell: ({ row }) => <span>{fmt(row.original.amount)}</span>,
      },
    ],
    []
  );

  const paymentColumns: ColumnDef<InvoicePaymentRow>[] = useMemo(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => <span>{new Date(row.original.date).toLocaleDateString()}</span>,
      },
      { accessorKey: "method", header: "Method" },
      {
        accessorKey: "reference",
        header: "Reference",
        cell: ({ row }) => <span>{row.original.reference ?? "—"}</span>,
      },
      {
        accessorKey: "amount",
        header: "Amount",
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
        cell: ({ row }) => <span>{fmt(row.original.amount)}</span>,
      },
    ],
    []
  );

  if (!invoice) return null;
  const record = invoice;

  function setItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const lines = items
      .filter((l) => l.description && l.unitPrice !== "")
      .map((l) => ({
        description: l.description,
        quantity: Number(l.quantity || 1),
        unitPrice: Number(l.unitPrice),
      }));
    if (lines.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/accounting/invoices/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        issueDate,
        dueDate: dueDate || null,
        discount: Number(discount) || 0,
        notes: notes || null,
        lines,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      toast.success("Invoice updated");
      onUpdated(data.invoice);
      setMode("view");
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to update invoice");
    }
  }

  const paid = Number(invoice.amountPaid) || 0;
  const balance = Number(invoice.total) - paid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoice.invoiceNumber}</DialogTitle>
        </DialogHeader>

        {mode === "view" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{invoice.customer?.name ?? "—"}</p>
                <p className="text-sm text-muted-foreground">
                  {invoice.customer?.email && `${invoice.customer.email} · `}
                  {invoice.customer?.phone ?? ""}
                </p>
              </div>
              <Badge variant={badgeVariant[invoice.status] ?? "outline"}>{invoice.status}</Badge>
            </div>

            <DetailGrid>
              <DetailField label="Issue date">{invoice.issueDate.slice(0, 10)}</DetailField>
              <DetailField label="Due date">{invoice.dueDate ? invoice.dueDate.slice(0, 10) : "—"}</DetailField>
              <DetailField label="Subtotal">{fmt(invoice.subtotal)}</DetailField>
              <DetailField label="Tax">{fmt(invoice.taxAmount)}</DetailField>
              <DetailField label="Discount">{fmt(invoice.discount)}</DetailField>
              <DetailField label="Total">{fmt(invoice.total)}</DetailField>
              <DetailField label="Amount paid">{fmt(paid)}</DetailField>
              <DetailField label="Balance">{fmt(balance)}</DetailField>
              <DetailField label="Notes" full>
                {invoice.notes || "—"}
              </DetailField>
            </DetailGrid>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Line items</h4>
              <Card className="overflow-hidden p-2">
                <DataTable
                  columns={lineColumns}
                  data={invoice.lines}
                  paginated={false}
                  dense
                  emptyMessage="No line items"
                />
              </Card>
            </div>

            {invoice.payments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Payments</h4>
                <Card className="overflow-hidden p-2">
                  <DataTable
                    columns={paymentColumns}
                    data={invoice.payments}
                    paginated={false}
                    dense
                    emptyMessage="No payments"
                  />
                </Card>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={customerId || undefined} onValueChange={setCustomerId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-issueDate">Issue date</Label>
                <Input
                  id="edit-issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-dueDate">Due date</Label>
                <Input
                  id="edit-dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
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
                <Label htmlFor="edit-discount">Discount</Label>
                <Input
                  id="edit-discount"
                  type="number"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Input id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
            {canEdit && editable && <Button onClick={() => setMode("edit")}>Edit</Button>}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}