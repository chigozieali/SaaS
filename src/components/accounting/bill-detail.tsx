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

export type BillLineRow = {
  id: string;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  amount: string | number;
};

export type PaymentRow = {
  id: string;
  amount: string | number;
  method: string;
  reference: string | null;
  date: string;
};

export type BillRow = {
  id: string;
  billNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: string;
  subtotal: string | number;
  taxAmount: string | number;
  total: string | number;
  amountPaid: string | number;
  notes: string | null;
  vendor: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    taxId?: string | null;
  };
  lines: BillLineRow[];
  payments: PaymentRow[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: BillRow | null;
  vendors: Array<{ id: string; name: string }>;
  canEdit: boolean;
  onUpdated: (bill?: BillRow) => void;
};

type Item = { description: string; quantity: string; unitPrice: string };

const badgeVariant: Record<string, "warning" | "success" | "destructive" | "info" | "outline"> = {
  unpaid: "warning",
  partial: "info",
  paid: "success",
  overdue: "destructive",
  cancelled: "outline",
};

const fmt = (n: string | number) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

export function BillDetail({ open, onOpenChange, bill, vendors, canEdit, onUpdated }: Props) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [saving, setSaving] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode("view");
    if (bill) {
      setVendorId(bill.vendor?.id ?? "");
      setIssueDate(bill.issueDate ? bill.issueDate.slice(0, 10) : "");
      setDueDate(bill.dueDate ? bill.dueDate.slice(0, 10) : "");
      setNotes(bill.notes ?? "");
      setItems(
        bill.lines.map((l) => ({
          description: l.description,
          quantity: String(Number(l.quantity) || 1),
          unitPrice: String(Number(l.unitPrice) || 0),
        }))
      );
    }
  }, [open, bill]);

  const editable = !!bill && bill.status !== "paid" && bill.status !== "cancelled";

  const lineColumns: ColumnDef<BillLineRow>[] = useMemo(
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

  const paymentColumns: ColumnDef<PaymentRow>[] = useMemo(
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

  if (!bill) return null;
  const record = bill;

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
    const res = await fetch(`/api/accounting/bills/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId,
        issueDate,
        dueDate: dueDate || null,
        notes: notes || null,
        lines,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      toast.success("Bill updated");
      onUpdated(data.bill);
      setMode("view");
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to update bill");
    }
  }

  const paid = Number(bill.amountPaid) || 0;
  const balance = Number(bill.total) - paid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bill.billNumber}</DialogTitle>
        </DialogHeader>

        {mode === "view" ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{bill.vendor?.name ?? "—"}</p>
                <p className="text-sm text-muted-foreground">
                  {bill.vendor?.email && `${bill.vendor.email} · `}
                  {bill.vendor?.phone ?? ""}
                </p>
              </div>
              <Badge variant={badgeVariant[bill.status] ?? "outline"}>{bill.status}</Badge>
            </div>

            <DetailGrid>
              <DetailField label="Issue date">{bill.issueDate.slice(0, 10)}</DetailField>
              <DetailField label="Due date">{bill.dueDate ? bill.dueDate.slice(0, 10) : "—"}</DetailField>
              <DetailField label="Subtotal">{fmt(bill.subtotal)}</DetailField>
              <DetailField label="Tax">{fmt(bill.taxAmount)}</DetailField>
              <DetailField label="Total">{fmt(bill.total)}</DetailField>
              <DetailField label="Amount paid">{fmt(paid)}</DetailField>
              <DetailField label="Balance">{fmt(balance)}</DetailField>
              <DetailField label="Notes" full>
                {bill.notes || "—"}
              </DetailField>
            </DetailGrid>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Line items</h4>
              <Card className="overflow-hidden p-2">
                <DataTable
                  columns={lineColumns}
                  data={bill.lines}
                  paginated={false}
                  dense
                  emptyMessage="No line items"
                />
              </Card>
            </div>

            {bill.payments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Payments</h4>
                <Card className="overflow-hidden p-2">
                  <DataTable
                    columns={paymentColumns}
                    data={bill.payments}
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
                <Label>Vendor</Label>
                <Select value={vendorId || undefined} onValueChange={setVendorId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
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

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Input id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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