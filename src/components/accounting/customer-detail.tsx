"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DetailField, DetailGrid } from "@/components/modules/detail-field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  isActive: boolean;
  _count?: { invoices: number };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerRow | null;
  canEdit: boolean;
  onUpdated: (customer?: CustomerRow) => void;
};

const emptyForm = { name: "", email: "", phone: "", address: "", taxId: "" };

export function CustomerDetail({ open, onOpenChange, customer, canEdit, onUpdated }: Props) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode("view");
    if (customer) {
      setForm({
        name: customer.name,
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        address: customer.address ?? "",
        taxId: customer.taxId ?? "",
      });
    }
  }, [open, customer]);

  if (!customer) return null;
  const record = customer;

  const update =
    (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/accounting/customers/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        taxId: form.taxId || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      toast.success("Customer updated");
      onUpdated(data.customer);
      setMode("view");
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to update customer");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{customer.name}</DialogTitle>
        </DialogHeader>

        {mode === "view" ? (
          <DetailGrid>
            <DetailField label="Status">
              <Badge variant={customer.isActive ? "success" : "destructive"}>
                {customer.isActive ? "Active" : "Inactive"}
              </Badge>
            </DetailField>
            <DetailField label="Invoices">{customer._count?.invoices ?? 0}</DetailField>
            <DetailField label="Email">{customer.email || "—"}</DetailField>
            <DetailField label="Phone">{customer.phone || "—"}</DetailField>
            <DetailField label="Address" full>
              {customer.address || "—"}
            </DetailField>
            <DetailField label="Tax ID">{customer.taxId || "—"}</DetailField>
          </DetailGrid>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Customer name</Label>
              <Input id="edit-name" value={form.name} onChange={update("name")} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" value={form.email} onChange={update("email")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input id="edit-phone" value={form.phone} onChange={update("phone")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address">Address</Label>
                <Input id="edit-address" value={form.address} onChange={update("address")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-taxId">Tax ID</Label>
                <Input id="edit-taxId" value={form.taxId} onChange={update("taxId")} />
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
            {canEdit && <Button onClick={() => setMode("edit")}>Edit</Button>}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}