"use client";

import { useMemo, useState } from "react";
import { Undo2, Send, CheckCircle2, CheckCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  createdAt: string;
  approvedAt: string | null;
  postedAt: string | null;
  reversedAt: string | null;
  period: { id: string; name: string } | null;
  createdBy: { id: string; name: string | null } | null;
  approvedBy: { id: string; name: string | null } | null;
  postedBy: { id: string; name: string | null } | null;
  reversedBy: { id: string; name: string | null } | null;
  reversalOf: { id: string; entryNumber: string; date: string; status: string } | null;
  reversals: { id: string; entryNumber: string; date: string; status: string }[];
  lines: JournalLineRow[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: JournalEntryRow | null;
  onMutate?: () => void;
};

const fmt = (n: number | string) =>
  Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
const fmtName = (u: { name: string | null } | null) => u?.name ?? "—";

const statusVariant = (status: string) => {
  switch (status) {
    case "posted":
      return "success" as const;
    case "reversed":
      return "secondary" as const;
    case "approved":
      return "default" as const;
    case "pending":
      return "warning" as const;
    default:
      return "outline" as const;
  }
};

export function JournalDetail({ open, onOpenChange, entry, onMutate }: Props) {
  const [busy, setBusy] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseDate, setReverseDate] = useState("");
  const [reverseNote, setReverseNote] = useState("");

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

  async function runAction(action: string, extra?: Record<string, string>) {
    if (!entry) return false;
    setBusy(true);
    const res = await fetch(`/api/accounting/journal/${entry.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setBusy(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.message ?? "Action failed");
      return false;
    }
    toast.success(
      action === "submit"
        ? "Submitted for approval"
        : action === "approve"
          ? "Entry approved"
          : action === "post"
            ? "Entry posted"
            : "Entry reversed"
    );
    setReverseOpen(false);
    onMutate?.();
    onOpenChange(false);
    return true;
  }

  async function deleteEntry() {
    if (!entry) return;
    if (!confirm("Delete this journal entry?")) return;
    setBusy(true);
    const res = await fetch(`/api/accounting/journal/${entry.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      toast.success("Entry deleted");
      onMutate?.();
      onOpenChange(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Delete failed");
    }
  }

  const audit: { label: string; who: string; when: string }[] = [
    { label: "Created", who: fmtName(entry.createdBy), when: fmtDate(entry.createdAt) },
    ...(entry.approvedAt
      ? [{ label: "Approved", who: fmtName(entry.approvedBy), when: fmtDate(entry.approvedAt) }]
      : []),
    ...(entry.postedAt
      ? [{ label: "Posted", who: fmtName(entry.postedBy), when: fmtDate(entry.postedAt) }]
      : []),
    ...(entry.reversedAt
      ? [{ label: "Reversed", who: fmtName(entry.reversedBy), when: fmtDate(entry.reversedAt) }]
      : []),
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="font-mono text-base">{entry.entryNumber}</DialogTitle>
              <Badge variant={statusVariant(entry.status)}>{entry.status}</Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            <div className="text-sm text-muted-foreground">
              {new Date(entry.date).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>

            {entry.status === "reversed" && entry.reversalOf && (
              <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Reversed by entry{" "}
                <span className="font-mono font-medium">{entry.reversalOf.entryNumber}</span>.
              </div>
            )}
            {entry.status === "posted" && entry.reversals.length > 0 && (
              <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Reversed by{" "}
                {entry.reversals.map((r) => (
                  <span key={r.id} className="font-mono font-medium">
                    {r.entryNumber}
                  </span>
                ))}
                .
              </div>
            )}

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

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Audit trail</h4>
              <Card className="p-4">
                <div className="space-y-2">
                  {audit.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="text-right">
                        <span className="font-medium">{row.who}</span>
                        <span className="ml-2 text-muted-foreground">{row.when}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {entry.status === "draft" || entry.status === "pending" ? (
              <div className="flex flex-wrap justify-end gap-2">
                {entry.status === "draft" && (
                  <Button onClick={() => runAction("submit")} disabled={busy}>
                    <Send className="mr-2 h-4 w-4" /> Submit for approval
                  </Button>
                )}
                {entry.status === "pending" && (
                  <Button onClick={() => runAction("approve")} disabled={busy}>
                    <CheckCheck className="mr-2 h-4 w-4" /> Approve
                  </Button>
                )}
                <Button variant="destructive" onClick={deleteEntry} disabled={busy}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </div>
            ) : null}

            {entry.status === "approved" ? (
              <div className="flex justify-end">
                <Button onClick={() => runAction("post")} disabled={busy}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Post entry
                </Button>
              </div>
            ) : null}

            {entry.status === "posted" ? (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReverseDate(new Date().toISOString().slice(0, 10));
                    setReverseNote("");
                    setReverseOpen(true);
                  }}
                  disabled={busy}
                >
                  <Undo2 className="mr-2 h-4 w-4" /> Reverse entry
                </Button>
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse journal entry</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              runAction("reverse", { date: reverseDate, description: reverseNote });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="reverse-date">Reversal date</Label>
              <Input
                id="reverse-date"
                type="date"
                required
                value={reverseDate}
                onChange={(e) => setReverseDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reverse-note">Reason / reference (optional)</Label>
              <Input
                id="reverse-note"
                value={reverseNote}
                onChange={(e) => setReverseNote(e.target.value)}
                placeholder="Reversal of balance sheet adjustment"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReverseOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Reversing…" : "Create reversal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}