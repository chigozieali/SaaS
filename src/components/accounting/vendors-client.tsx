"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus } from "lucide-react";
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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type VendorRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  _count: { bills: number };
};

export function VendorsClient() {
  const { data, mutate } = useSWR("/api/accounting/vendors", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const vendors = data?.vendors ?? [];

  const columns: ColumnDef<VendorRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorFn: (v) => v.email ?? "",
      id: "email",
      header: "Email",
      cell: ({ row }) => <span>{row.original.email ?? "—"}</span>,
    },
    {
      accessorFn: (v) => v.phone ?? "",
      id: "phone",
      header: "Phone",
      cell: ({ row }) => <span>{row.original.phone ?? "—"}</span>,
    },
    {
      accessorFn: (v) => v._count.bills,
      id: "bills",
      header: "Bills",
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => <Badge variant="secondary">{row.original._count.bills}</Badge>,
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
    const res = await fetch("/api/accounting/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Vendor created");
      mutate();
      setOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to create vendor");
    }
  }

  return (
    <div>
      <PageHeader title="Vendors" description="Manage your supplier directory.">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Vendor
        </Button>
      </PageHeader>

      {vendors.length === 0 ? (
        <EmptyState
          title="No vendors yet"
          description="Add vendors to record bills and track amounts payable."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Vendor
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={vendors as VendorRow[]}
            filterKeys={["name", "email", "phone"]}
            searchPlaceholder="Search vendors…"
            emptyMessage="No vendors match your search"
            pageSize={10}
          />
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Vendor</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Vendor name</Label>
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
                {saving ? "Saving…" : "Create vendor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}