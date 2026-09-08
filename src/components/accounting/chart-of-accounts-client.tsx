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
import { DataTable } from "@/components/ui/data-table";
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

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const types = ["asset", "liability", "equity", "revenue", "expense"] as const;

type AccountRow = {
  id: string;
  code: string;
  name: string;
  parent?: { name: string } | null;
};

const accountColumns: ColumnDef<AccountRow>[] = [
  {
    accessorKey: "code",
    header: "Code",
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <span>
        {row.original.name}
        {row.original.parent ? (
          <span className="ml-1 text-xs text-muted-foreground">· {row.original.parent.name}</span>
        ) : null}
      </span>
    ),
  },
];

export function ChartOfAccountsClient() {
  const { data, mutate } = useSWR("/api/accounting/accounts", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState("asset");
  const [parentId, setParentId] = useState("");

  const accounts = data?.accounts ?? [];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      code: formData.get("code"),
      name: formData.get("name"),
      type,
      subtype: (formData.get("subtype") as string) || undefined,
      parentId: parentId || undefined,
    };
    setSaving(true);
    const res = await fetch("/api/accounting/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Account created");
      mutate();
      setOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to create account");
    }
  }

  const grouped = (["asset", "liability", "equity", "revenue", "expense"] as const).map((t) => ({
    type: t,
    accounts: accounts.filter((a: { type: string }) => a.type === t),
  }));

  return (
    <div>
      <PageHeader title="Chart of Accounts" description="Manage your financial account structure.">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Account
        </Button>
      </PageHeader>

      {accounts.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="Accounts are seeded when your organization is created. Add more accounts as needed."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Account
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {grouped.map(({ type: t, accounts: list }) => (
            <Card key={t} className="overflow-hidden p-2">
              <div className="mb-2 px-4 pt-2 font-semibold capitalize">{t}</div>
              <DataTable
                columns={accountColumns}
                data={list as AccountRow[]}
                filterKeys={["code", "name", "parent.name"]}
                searchPlaceholder={`Search ${t} accounts…`}
                emptyMessage={`No ${t} accounts match your search`}
                pageSize={10}
              />
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input id="code" name="code" placeholder="1000" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtype">Subtype (optional)</Label>
                <Input id="subtype" name="subtype" placeholder="Current asset" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Account name</Label>
              <Input id="name" name="name" placeholder="Cash in bank" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Parent account</Label>
                <Select value={parentId || undefined} onValueChange={setParentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a: { id: string; name: string }) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
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
                {saving ? "Saving…" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}