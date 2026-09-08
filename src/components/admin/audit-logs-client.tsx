"use client";

import useSWR from "swr";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/modules/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataTable } from "@/components/ui/data-table";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type AuditLogRow = {
  id: string;
  createdAt: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: unknown;
  user?: { name: string | null; email: string } | null;
};

export function AuditLogsClient() {
  const [take, setTake] = useState(100);
  const { data, isLoading } = useSWR(`/api/admin/audit-logs?take=${take}`, fetcher);
  const logs = data?.logs ?? [];

  const columns: ColumnDef<AuditLogRow>[] = [
    {
      accessorFn: (log) => new Date(log.createdAt).getTime(),
      id: "time",
      header: "Time",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs">
          {new Date(row.original.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      accessorFn: (log) => log.user?.name ?? log.user?.email ?? "",
      id: "user",
      header: "User",
      cell: ({ row }) => {
        const log = row.original;
        return (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">
                {(log.user?.name ?? log.user?.email ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">{log.user?.name ?? log.user?.email ?? "System"}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.action}
        </Badge>
      ),
    },
    {
      accessorFn: (log) => `${log.entity} ${log.entityId ?? ""}`,
      id: "entity",
      header: "Entity",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.entity.replace(/_/g, " ")}
          {row.original.entityId ? (
            <span className="ml-1 font-mono text-xs text-muted-foreground">
              #{row.original.entityId.slice(0, 8)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      accessorFn: (log) => (log.metadata ? JSON.stringify(log.metadata) : ""),
      id: "details",
      header: "Details",
      cell: ({ row }) => (
        <span className="break-all font-mono text-xs text-muted-foreground">
          {row.original.metadata ? JSON.stringify(row.original.metadata) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Audit Logs" description="Every significant action in your organization." />

      <Card className="overflow-hidden p-2">
        <DataTable
          columns={columns}
          data={logs as AuditLogRow[]}
          filterKeys={["user.name", "user.email", "action", "entity", "entityId"]}
          searchPlaceholder="Search logs…"
          toolbar={
            <div className="flex items-center gap-2">
              <Input
                className="w-24"
                type="number"
                min={10}
                max={500}
                value={take}
                onChange={(e) => setTake(Number(e.target.value))}
              />
              <span className="text-sm text-muted-foreground">recent</span>
            </div>
          }
          loading={isLoading}
          emptyMessage={isLoading ? "Loading…" : "No activity yet."}
          pageSize={25}
        />
      </Card>
    </div>
  );
}