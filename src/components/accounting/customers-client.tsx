"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus, Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomerDetail, type CustomerRow } from "@/components/accounting/customer-detail";
import { hasPermission } from "@/lib/client-permissions";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function CustomersClient({ permissions }: { permissions?: Set<string> }) {
  const { data, mutate } = useSWR("/api/accounting/customers", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const customers = data?.customers ?? [];
  const canEdit = hasPermission(permissions, "accounting.invoices");

  const columns: ColumnDef<CustomerRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorFn: (c) => c.email ?? "",
      id: "email",
      header: "Email",
      cell: ({ row }) => <span>{row.original.email ?? "—"}</span>,
    },
    {
      accessorFn: (c) => c.phone ?? "",
      id: "phone",
      header: "Phone",
      cell: ({ row }) => <span>{row.original.phone ?? "—"}</span>,
    },
    {
      accessorFn: (c) => c._count?.invoices,
      id: "invoices",
      header: "Invoices",
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => <Badge variant="secondary">{row.original._count?.invoices ?? 0}</Badge>,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      size: 44,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setSelected(row.original)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      email: (formData.get("email") as string) || undefined,
      phone: (formData.get("phone") as string) || undefined,
      address: (formData.get("address") as string) || undefined,
      taxId: (formData.get("taxId") as string) || undefined,
    };
    setSaving(true);
    const res = await fetch("/api/accounting/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Customer created");
      mutate();
      setOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to create customer");
    }
  }

  return (
    <div>
      <PageHeader title="Customers" description="Manage your customer directory.">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Customer
        </Button>
      </PageHeader>

      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add customers to invoice and track amounts receivable."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Customer
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={customers as CustomerRow[]}
            filterKeys={["name", "email", "phone"]}
            searchPlaceholder="Search customers…"
            emptyMessage="No customers match your search"
            pageSize={10}
          />
        </Card>
      )}

      <CustomerDetail
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        customer={selected}
        canEdit={canEdit}
        onUpdated={(updated) => {
          mutate();
          if (updated) setSelected((prev) => ({ ...prev, ...updated }));
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Customer name</Label>
              <Input id="name" name="name" required />
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
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID</Label>
                <Input id="taxId" name="taxId" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Create customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}