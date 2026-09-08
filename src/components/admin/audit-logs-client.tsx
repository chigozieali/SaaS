"use client";

import useSWR from "swr";
import { useState } from "react";
import { PageHeader } from "@/components/modules/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function AuditLogsClient() {
  const [take, setTake] = useState(100);
  const { data, isLoading } = useSWR(`/api/admin/audit-logs?take=${take}`, fetcher);
  const logs = data?.logs ?? [];

  return (
    <div>
      <PageHeader title="Audit Logs" description="Every significant action in your organization." />

      <div className="mb-4 flex items-center gap-2">
        <Input
          className="w-32"
          type="number"
          min={10}
          max={500}
          value={take}
          onChange={(e) => setTake(Number(e.target.value))}
        />
        <span className="text-sm text-muted-foreground">recent entries to show</span>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No activity yet.
                </TableCell>
              </TableRow>
            )}
            {logs.map((log: Record<string, any>) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-xs">
                  {new Date(log.createdAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px]">
                        {(log.user?.name ?? log.user?.email ?? "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{log.user?.name ?? log.user?.email ?? "System"}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {log.entity.replace(/_/g, " ")}
                  {log.entityId ? (
                    <span className="ml-1 font-mono text-xs text-muted-foreground">
                      #{log.entityId.slice(0, 8)}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {log.metadata ? JSON.stringify(log.metadata) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}