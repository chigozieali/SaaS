"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/modules/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

export function RolesClient() {
  const { data, mutate } = useSWR("/api/admin/roles", fetcher);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const roles = data?.roles ?? [];
  const categories = data?.categories ?? {};

  function openCreate() {
    setEditing(null);
    setSelected(new Set());
    setCategory("");
    setOpen(true);
  }

  function openEdit(role: Record<string, any>) {
    setEditing(role);
    setSelected(new Set(role.permissions.map((p: any) => p.permission.key)));
    setCategory("");
    setOpen(true);
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = editing
      ? {
          id: editing.id,
          name: (formData.get("name") as string) || undefined,
          description: (formData.get("description") as string) || undefined,
          permissions: [...selected],
        }
      : {
          name: formData.get("name"),
          description: (formData.get("description") as string) || undefined,
          permissions: [...selected],
        };

    setSaving(true);
    const res = await fetch("/api/admin/roles", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(editing ? "Role updated" : "Role created");
      mutate();
      setOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to save role");
    }
  }

  const filteredKeys = category
    ? Object.entries(categories).filter(([cat]) => cat === category)
    : Object.entries(categories);

  return (
    <div>
      <PageHeader title="Roles & Permissions" description="Define what each role can access.">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Role
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role: Record<string, any>) => (
          <Card key={role.id} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{role.name}</p>
                <p className="text-xs text-muted-foreground">{role.description ?? "No description"}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => openEdit(role)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant="secondary">{role._count.memberships} user(s)</Badge>
              <Badge variant="outline">{role.permissions.length} permission(s)</Badge>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Role" : "New Role"}</DialogTitle>
            <DialogDescription>Select the permissions granted to this role.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Role name</Label>
                <Input id="name" name="name" defaultValue={editing?.name ?? ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" defaultValue={editing?.description ?? ""} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Filter by category</Label>
              <Select value={category || undefined} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(categories).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              {filteredKeys.map(([cat, keys]) => (
                <div key={cat}>
                  <p className="mb-2 text-sm font-semibold">{cat}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(keys as string[]).map((key) => (
                      <label key={key} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                        <span className="font-mono text-xs">{key}</span>
                        <Switch checked={selected.has(key)} onCheckedChange={() => toggle(key)} />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <div className="flex w-full items-center justify-between">
                <span className="text-sm text-muted-foreground">{selected.size} selected</span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save role"}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}