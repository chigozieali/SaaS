"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const types = ["asset", "liability", "equity", "revenue", "expense"] as const;
const typeLabel: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue / Income",
  expense: "Expenses",
};

type AccountRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  parentId: string | null;
  isActive: boolean;
  isSystem: boolean;
  parent?: { id: string; name: string } | null;
  _count?: { children: number };
};

const accountColumns = (onEdit: (a: AccountRow) => void, onToggle: (a: AccountRow) => void) => {
  const columns: ColumnDef<AccountRow>[] = [
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className={row.original.isActive ? "" : "text-muted-foreground line-through"}>
          {row.original.name}
          {row.original.parent ? (
            <span className="ml-1 text-xs text-muted-foreground">· {row.original.parent.name}</span>
          ) : null}
        </span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onToggle(row.original)}
            disabled={row.original.isSystem}
            title={row.original.isActive ? "Deactivate" : "Activate"}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
  return columns;
};

export function ChartOfAccountsClient() {
  const { data, mutate } = useSWR("/api/accounting/accounts", fetcher);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState("asset");
  const [parentId, setParentId] = useState("");
  const [editType, setEditType] = useState("asset");
  const [editParentId, setEditParentId] = useState<string | undefined>(undefined);

  const accounts = (data?.accounts ?? []) as AccountRow[];

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
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
      setCreateOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to create account");
    }
  }

  async function onUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const formData = new FormData(e.currentTarget);
    const payload = {
      code: formData.get("code"),
      name: formData.get("name"),
      type: editType,
      subtype: (formData.get("subtype") as string) || undefined,
      parentId: editParentId,
    };
    setSaving(true);
    const res = await fetch(`/api/accounting/accounts/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Account updated");
      mutate();
      setEditOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to update account");
    }
  }

  async function onToggle(row: AccountRow) {
    setSaving(true);
    const res = await fetch(`/api/accounting/accounts/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(row.isActive ? "Account deactivated" : "Account activated");
      mutate();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to update account");
    }
  }

  const grouped = (["asset", "liability", "equity", "revenue", "expense"] as const).map(
    (t) => ({
      type: t,
      accounts: accounts.filter((a) => a.type === t),
    })
  );

  return (
    <div>
      <PageHeader title="Chart of Accounts" description="Manage your financial account structure.">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Account
        </Button>
      </PageHeader>

      {accounts.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="Accounts are seeded when your organization is created. Add more accounts as needed."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Account
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {grouped.map(({ type: t, accounts: list }) => (
            <Card key={t} className="overflow-hidden p-2">
              <div className="mb-2 px-4 pt-2 font-semibold capitalize">{typeLabel[t]}</div>
              <DataTable
                columns={accountColumns(setEditingAndOpen, onToggle)}
                data={list as AccountRow[]}
                filterKeys={["code", "name", "parent.name"]}
                searchPlaceholder={`Search ${typeLabel[t].toLowerCase()}…`}
                emptyMessage={`No ${typeLabel[t].toLowerCase()} accounts match your search`}
                pageSize={7}
                dense
              />
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
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
                        {typeLabel[t]}
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
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={onUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-code">Code</Label>
                  <Input id="edit-code" name="code" defaultValue={editing.code} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-subtype">Subtype (optional)</Label>
                  <Input id="edit-subtype" name="subtype" defaultValue={editing.subtype ?? ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Account name</Label>
                <Input id="edit-name" name="name" defaultValue={editing.name} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={editType} onValueChange={setEditType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((t) => (
                        <SelectItem key={t} value={t}>
                          {typeLabel[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Parent account</Label>
                  <Select value={editParentId} onValueChange={setEditParentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter((a) => a.id !== editing.id)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  function setEditingAndOpen(row: AccountRow) {
    setEditing(row);
    setEditType(row.type);
    setEditParentId(row.parentId ?? undefined);
    setEditOpen(true);
  }
}