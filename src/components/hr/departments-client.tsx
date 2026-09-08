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
import { Badge } from "@/components/ui/badge";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type DepartmentRow = {
  id: string;
  name: string;
  code: string | null;
  manager?: { firstName: string; lastName: string } | null;
  _count: { employees: number };
};

export function DepartmentsClient() {
  const { data, mutate } = useSWR("/api/hr/departments", fetcher);
  const departments: DepartmentRow[] = data?.departments ?? [];
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const columns: ColumnDef<DepartmentRow>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "code",
      header: "Code",
      cell: ({ row }) => <span>{row.original.code ?? "—"}</span>,
    },
    {
      accessorFn: (d) => (d.manager ? `${d.manager.firstName} ${d.manager.lastName}` : ""),
      id: "manager",
      header: "Manager",
      cell: ({ row }) => (
        <span>
          {row.original.manager
            ? `${row.original.manager.firstName} ${row.original.manager.lastName}`
            : "—"}
        </span>
      ),
    },
    {
      accessorFn: (d) => d._count.employees,
      id: "employees",
      header: "Employees",
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original._count.employees}</Badge>
      ),
    },
  ];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name"),
      code: formData.get("code") ?? undefined,
    };
    setSaving(true);
    const res = await fetch("/api/hr/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Department created");
      mutate();
      setOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to create department");
    }
  }

  return (
    <div>
      <PageHeader title="Departments" description="Organize employees into business units.">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Department
        </Button>
      </PageHeader>

      {departments.length === 0 ? (
        <EmptyState
          title="No departments yet"
          description="Create departments to group your employees."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Department
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={departments}
            filterKeys={["name", "code", "manager.firstName", "manager.lastName"]}
            searchPlaceholder="Search departments…"
            emptyMessage="No departments match your search"
            pageSize={10}
          />
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Department</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Department name</Label>
              <Input id="name" name="name" placeholder="Engineering" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code (optional)</Label>
              <Input id="code" name="code" placeholder="ENG" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}