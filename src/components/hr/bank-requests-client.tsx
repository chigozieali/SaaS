"use client";

import useSWR from "swr";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { PageHeader } from "@/components/modules/page-header";
import { EmptyState } from "@/components/modules/empty-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const fmtDate = (d: string) => new Date(d).toLocaleDateString();

type RequestRow = {
  id: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  status: string;
  notes: string | null;
  reviewNotes: string | null;
  requestedAt: string;
  employee: { firstName: string; lastName: string; employeeCode: string } | null;
};

const statusVariant: Record<string, "warning" | "success" | "destructive" | "secondary"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
};

export function BankRequestsClient() {
  const { data, mutate } = useSWR<{ requests: RequestRow[] }>("/api/admin/bank-requests", fetcher);
  const requests = data?.requests ?? [];
  const [processing, setProcessing] = useState<string | null>(null);

  async function review(request: RequestRow, status: "approved" | "rejected") {
    setProcessing(request.id);
    const notes = window.prompt(`${status === "approved" ? "Approve" : "Reject"} request — optional note:`)?.trim();
    const res = await fetch("/api/admin/bank-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: request.id, status, reviewNotes: notes || undefined }),
    });
    setProcessing(null);
    if (res.ok) {
      toast.success(status === "approved" ? "Request approved" : "Request rejected");
      mutate();
    } else {
      const d = await res.json().catch(() => null);
      toast.error(d?.message ?? "Failed to review request");
    }
  }

  const columns: ColumnDef<RequestRow>[] = [
    {
      accessorFn: (r) => `${r.employee?.firstName ?? ""} ${r.employee?.lastName ?? ""}`,
      id: "employee",
      header: "Employee",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.employee?.firstName} {row.original.employee?.lastName}
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            {row.original.employee?.employeeCode ?? ""}
          </div>
        </div>
      ),
    },
    {
      id: "bank",
      header: "Requested details",
      cell: ({ row }) => (
        <div className="text-sm">
          <div className="font-medium">{row.original.bankName}</div>
          <div className="text-muted-foreground">
            {row.original.bankAccountNumber} · {row.original.bankAccountName}
          </div>
          {row.original.notes ? (
            <div className="mt-0.5 text-xs italic text-muted-foreground">{row.original.notes}</div>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "requestedAt",
      header: "Requested",
      cell: ({ row }) => <span className="text-sm">{fmtDate(row.original.requestedAt)}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant[row.original.status] ?? "secondary"}>{row.original.status}</Badge>
      ),
    },
    {
      accessorKey: "reviewNotes",
      header: "Review note",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.reviewNotes || "—"}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) =>
        row.original.status !== "pending" ? null : (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              disabled={processing === row.original.id}
              onClick={() => review(row.original, "rejected")}
            >
              Reject
            </Button>
            <Button
              size="sm"
              className="h-7"
              disabled={processing === row.original.id}
              onClick={() => review(row.original, "approved")}
            >
              Approve
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Bank Detail Requests"
        description="Review employee bank detail change requests. Approving updates the employee's bank details."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No bank detail requests"
          description="Requests submitted by employees through self-service will appear here."
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={requests}
            filterKeys={["employee.firstName", "employee.lastName", "bankName", "status"]}
            searchPlaceholder="Search requests…"
            emptyMessage="No requests match"
            pageSize={10}
          />
        </Card>
      )}
    </div>
  );
}