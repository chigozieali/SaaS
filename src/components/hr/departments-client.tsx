"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus, Users } from "lucide-react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type DepartmentEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string | null;
  email: string | null;
  isActive: boolean;
  position: { id: string; title: string } | null;
};

type DepartmentRow = {
  id: string;
  name: string;
  code: string | null;
  manager?: { firstName: string; lastName: string } | null;
  employees: DepartmentEmployee[];
  _count: { employees: number };
};

export function DepartmentsClient() {
  const { data, mutate } = useSWR("/api/hr/departments", fetcher);
  const departments: DepartmentRow[] = data?.departments ?? [];
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<DepartmentRow | null>(null);
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
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          className="h-7"
          onClick={() => setViewing(row.original)}
        >
          <Users className="h-3 w-3" /> View
        </Button>
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

      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>
              {viewing?._count.employees ?? 0} employee{(viewing?._count.employees ?? 0) === 1 ? "" : "s"} ·{" "}
              {viewing?.manager
                ? `Manager: ${viewing.manager.firstName} ${viewing.manager.lastName}`
                : "No manager assigned"}
            </DialogDescription>
          </DialogHeader>
          {viewing && viewing.employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No employees in this department yet.</p>
          ) : (
            <div className="divide-y rounded-md border">
              {viewing?.employees.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between gap-4 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {emp.firstName} {emp.lastName}
                      {!emp.isActive && (
                        <Badge variant="destructive" className="ml-2">
                          Inactive
                        </Badge>
                      )}
                    </p>
                    {emp.position && (
                      <p className="truncate text-xs text-muted-foreground">{emp.position.title}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {emp.employeeCode && (
                      <p className="text-xs text-muted-foreground">{emp.employeeCode}</p>
                    )}
                    {emp.email && <p className="text-xs text-muted-foreground">{emp.email}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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