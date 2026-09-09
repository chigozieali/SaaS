"use client";

import useSWR from "swr";
import { useState } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PageHeader } from "@/components/modules/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataTable } from "@/components/ui/data-table";
import { PERMISSION_CATEGORIES } from "@/lib/permission-constants";
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
const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

type MemberRow = {
  id: string;
  createdAt: string;
  role?: { name: string } | null;
  grants: string[];
  user: { id: string; name: string | null; email: string; isActive: boolean };
};

export function UsersClient({ canSuper = false }: { canSuper?: boolean }) {
  const { data, mutate } = useSWR("/api/admin/users", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [permMember, setPermMember] = useState<MemberRow | null>(null);
  const [permKeys, setPermKeys] = useState<string[]>([]);
  const [permSaving, setPermSaving] = useState(false);

  const members = (data?.members ?? []) as MemberRow[];
  const roles = data?.roles ?? [];
  const effectiveCanSuper = data?.canSuper ?? canSuper;

  function openPermissions(member: MemberRow) {
    setPermMember(member);
    setPermKeys(member.grants ?? []);
  }

  function toggleKey(key: string) {
    setPermKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function savePermissions() {
    if (!permMember) return;
    setPermSaving(true);
    const res = await fetch(`/api/admin/users/${permMember.user.id}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionKeys: permKeys }),
    });
    setPermSaving(false);
    if (res.ok) {
      toast.success("Permissions updated");
      mutate();
      setPermMember(null);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to update permissions");
    }
  }

  const columns: ColumnDef<MemberRow>[] = [
    {
      accessorFn: (m) => `${m.user.name ?? ""} ${m.user.email}`,
      id: "user",
      header: "User",
      cell: ({ row }) => {
        const m = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials(m.user.name ?? m.user.email)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{m.user.name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{m.user.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorFn: (m) => m.role?.name ?? "",
      id: "role",
      header: "Role",
      cell: ({ row }) => <Badge variant="secondary">{row.original.role?.name ?? "No role"}</Badge>,
    },
    {
      accessorFn: (m) => m.grants.length,
      id: "grants",
      header: "Extra permissions",
      cell: ({ row }) =>
        row.original.grants.length > 0 ? (
          <Badge variant="info">{row.original.grants.length} granted</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      accessorFn: (m) => (m.user.isActive ? "Active" : "Inactive"),
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.user.isActive ? "success" : "destructive"}>
          {row.original.user.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      accessorFn: (m) => new Date(m.createdAt).getTime(),
      id: "joined",
      header: "Joined",
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  if (effectiveCanSuper) {
    columns.push({
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          className="h-7"
          onClick={() => openPermissions(row.original)}
        >
          <ShieldCheck className="h-3 w-3" /> Permissions
        </Button>
      ),
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      email: formData.get("email"),
      name: (formData.get("name") as string) || undefined,
      roleId: roleId || undefined,
      password: (formData.get("password") as string) || undefined,
    };
    setSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("User added");
      mutate();
      setOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to add user");
    }
  }

  return (
    <div>
      <PageHeader title="Users" description="Manage who can access your organization.">
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" /> Add User
        </Button>
      </PageHeader>

      <Card className="overflow-hidden p-2">
        <DataTable
          columns={columns}
          data={members as MemberRow[]}
          filterKeys={["user.name", "user.email", "role.name"]}
          searchPlaceholder="Search users…"
          emptyMessage="No members yet."
          pageSize={10}
        />
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Add a new member to your organization.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Temporary password</Label>
              <Input id="password" name="password" type="password" placeholder="min. 6 characters" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={roleId || undefined} onValueChange={setRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r: { id: string; name: string }) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Adding…" : "Add user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!permMember} onOpenChange={(o) => !o && setPermMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extra permissions</DialogTitle>
            <DialogDescription>
              Grant individual permissions to{" "}
              <span className="font-medium">{permMember?.user.name ?? permMember?.user.email}</span>{" "}
              in addition to their role. Role permissions cannot be removed here — only extra
              grants.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
            {Object.entries(PERMISSION_CATEGORIES).map(([category, keys]) => (
              <div key={category}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </p>
                <div className="space-y-1">
                  {keys.map((key) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={permKeys.includes(key)}
                        onChange={() => toggleKey(key)}
                        className="accent-primary"
                      />
                      <span>{key}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPermMember(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={savePermissions} disabled={permSaving}>
              {permSaving ? "Saving…" : "Save permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}