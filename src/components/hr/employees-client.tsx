"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus, MoreHorizontal, Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeeDialog } from "@/components/hr/employee-dialog";
import { EmployeeDetail, type EmployeeRow } from "@/components/hr/employee-detail";
import { hasPermission } from "@/lib/client-permissions";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function EmployeesClient({ permissions }: { permissions?: Set<string> }) {
  const { data, mutate } = useSWR("/api/hr/employees", fetcher);
  const employees: EmployeeRow[] = data?.employees ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<EmployeeRow | null>(null);
  const canEdit = hasPermission(permissions, "employees.edit");

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/hr/employees/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Employee deactivated");
      mutate();
    } else {
      toast.error("Failed to deactivate employee");
    }
  };

  const columns: ColumnDef<EmployeeRow>[] = [
    {
      accessorKey: "employeeCode",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.employeeCode}</span>
      ),
    },
    {
      accessorFn: (e) => `${e.firstName} ${e.lastName}`,
      id: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.firstName} {row.original.lastName}
        </span>
      ),
    },
    {
      accessorFn: (e) => e.department?.name ?? "",
      id: "department",
      header: "Department",
      cell: ({ row }) => <span>{row.original.department?.name ?? "—"}</span>,
    },
    {
      accessorFn: (e) => e.position?.title ?? "",
      id: "position",
      header: "Position",
      cell: ({ row }) => <span>{row.original.position?.title ?? "—"}</span>,
    },
    {
      accessorFn: (e) => (e.isActive ? "Active" : "Inactive"),
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "success" : "destructive"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => {
        const employee = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSelected(employee)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleDelete(employee.id)}>
                  Deactivate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage your workforce."
      >
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Add Employee
        </Button>
      </PageHeader>

      {employees.length === 0 ? (
        <EmptyState
          title="No employees yet"
          description="Add your first employee to get started with HR, payroll and attendance."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Add Employee
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={employees}
            filterKeys={["employeeCode", "firstName", "lastName", "department.name", "position.title"]}
            searchPlaceholder="Search employees…"
            emptyMessage="No employees match your search"
            pageSize={10}
          />
        </Card>
      )}

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => {
          toast.success("Employee created");
          mutate();
          setDialogOpen(false);
        }}
      />

      <EmployeeDetail
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        employee={selected}
        managers={employees}
        canEdit={canEdit}
        onUpdated={(updated) => {
          mutate();
          if (updated) setSelected((prev) => ({ ...prev, ...updated }));
        }}
      />
    </div>
  );
}