"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus, MoreHorizontal } from "lucide-react";
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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type EmployeeRow = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  department?: { name: string } | null;
  position?: { title: string } | null;
  isActive: boolean;
};

const columns: ColumnDef<EmployeeRow>[] = [
  {
    accessorKey: "employeeCode",
    header: "Code",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.employeeCode}</span>
    ),
    meta: { cellClassName: "font-medium" },
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleDelete(employee.id)}>
              Deactivate
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

let handleDelete: (id: string) => void;

export function EmployeesClient() {
  const { data, mutate } = useSWR("/api/hr/employees", fetcher);
  const employees: EmployeeRow[] = data?.employees ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);

  handleDelete = async (id: string) => {
    const res = await fetch(`/api/hr/employees/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Employee deactivated");
      mutate();
    } else {
      toast.error("Failed to deactivate employee");
    }
  };

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
    </div>
  );
}