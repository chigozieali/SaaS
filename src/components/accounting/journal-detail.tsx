"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { DetailField, DetailGrid } from "@/components/modules/detail-field";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type JournalLineRow = {
  id: string;
  description: string | null;
  debit: number;
  credit: number;
  account: { code: string; name: string };
};

export type JournalEntryRow = {
  id: string;
  entryNumber: string;
  date: string;
  reference: string | null;
  description: string | null;
  status: string;
  source: string | null;
  period: { id: string; name: string } | null;
  lines: JournalLineRow[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: JournalEntryRow | null;
};

const fmt = (n: number | string) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

export function JournalDetail({ open, onOpenChange, entry }: Props) {
  const lineColumns: ColumnDef<JournalLineRow>[] = useMemo(
    () => [
      {
        accessorFn: (l) => `${l.account.code} ${l.account.name}`,
        id: "account",
        header: "Account",
        cell: ({ row }) => (
          <span>
            <span className="font-mono text-xs">{row.original.account.code}</span> ·{" "}
            {row.original.account.name}
          </span>
        ),
      },
      {
        accessorFn: (l) => l.description ?? "",
        id: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.description ?? "—"}</span>
        ),
      },
      {
        accessorFn: (l) => Number(l.debit),
        id: "debit",
        header: "Debit",
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
        cell: ({ row }) =>
          Number(row.original.debit) ? (
            <span>{fmt(row.original.debit)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorFn: (l) => Number(l.credit),
        id: "credit",
        header: "Credit",
        meta: { headerClassName: "text-right", cellClassName: "text-right" },
        cell: ({ row }) =>
          Number(row.original.credit) ? (
            <span>{fmt(row.original.credit)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    []
  );

  if (!entry) return null;

  const debit = entry.lines.reduce((s, l) => s + Number(l.debit), 0);
  const credit = entry.lines.reduce((s, l) => s + Number(l.credit), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry.entryNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {new Date(entry.date).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            <Badge variant={entry.status === "posted" ? "success" : "outline"}>
              {entry.status}
            </Badge>
          </div>

          <DetailGrid>
            <DetailField label="Reference">{entry.reference || "—"}</DetailField>
            <DetailField label="Source">{entry.source || "—"}</DetailField>
            <DetailField label="Period">{entry.period?.name ?? "—"}</DetailField>
            <DetailField label="Entry number">
              <span className="font-mono">{entry.entryNumber}</span>
            </DetailField>
            <DetailField label="Description" full>
              {entry.description || "—"}
            </DetailField>
          </DetailGrid>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Lines</h4>
            <Card className="overflow-hidden p-2">
              <DataTable
                columns={lineColumns}
                data={entry.lines}
                paginated={false}
                dense
                emptyMessage="No lines"
              />
            </Card>
            <div className="flex items-center justify-end gap-4 text-sm">
              <span>
                Debit total: <span className="font-semibold">{fmt(debit)}</span>
              </span>
              <span>
                Credit total: <span className="font-semibold">{fmt(credit)}</span>
              </span>
              <Badge variant={Math.abs(debit - credit) <= 0.01 ? "success" : "destructive"}>
                {Math.abs(debit - credit) <= 0.01 ? "Balanced" : "Out of balance"}
              </Badge>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}