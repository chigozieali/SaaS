"use client";

import useSWR from "swr";
import { useState } from "react";
import { UserPlus } from "lucide-react";
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
  user: { name: string | null; email: string; isActive: boolean };
};

export function UsersClient() {
  const { data, mutate } = useSWR("/api/admin/users", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleId, setRoleId] = useState("");

  const members = data?.members ?? [];
  const roles = data?.roles ?? [];

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
    </div>
  );
}