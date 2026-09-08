"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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

type Line = { accountCode: string; description: string; debit: string; credit: string };

type JournalLineRow = {
  id: string;
  description: string | null;
  debit: number;
  credit: number;
  account: { code: string; name: string };
};

const lineColumns: ColumnDef<JournalLineRow>[] = [
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
        <span>{Number(row.original.debit).toLocaleString()}</span>
      ) : (
        <span>—</span>
      ),
  },
  {
    accessorFn: (l) => Number(l.credit),
    id: "credit",
    header: "Credit",
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
    cell: ({ row }) =>
      Number(row.original.credit) ? (
        <span>{Number(row.original.credit).toLocaleString()}</span>
      ) : (
        <span>—</span>
      ),
  },
];

export function JournalClient() {
  const { data, mutate } = useSWR("/api/accounting/journal", fetcher);
  const { data: acctData } = useSWR("/api/accounting/accounts", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState<Line[]>([
    { accountCode: "", description: "", debit: "", credit: "" },
    { accountCode: "", description: "", debit: "", credit: "" },
  ]);

  const entries = data?.entries ?? [];
  const accounts = acctData?.accounts ?? [];

  function setLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const validLines = lines
      .filter((l) => l.accountCode && (l.debit || l.credit))
      .map((l) => ({
        accountCode: l.accountCode,
        description: l.description || undefined,
        debit: l.debit ? Number(l.debit) : 0,
        credit: l.credit ? Number(l.credit) : 0,
      }));

    const payload = {
      date: formData.get("date"),
      reference: (formData.get("reference") as string) || undefined,
      description: (formData.get("description") as string) || undefined,
      lines: validLines,
    };

    setSaving(true);
    const res = await fetch("/api/accounting/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Journal entry posted");
      mutate();
      setOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to post entry");
    }
  }

  return (
    <div>
      <PageHeader title="Journal Entries" description="Record double-entry transactions.">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Entry
        </Button>
      </PageHeader>

      {entries.length === 0 ? (
        <EmptyState
          title="No journal entries"
          description="Post your first journal entry."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Entry
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {entries.map((entry: Record<string, any>) => {
            const debit = entry.lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
            const credit = entry.lines.reduce((s: number, l: any) => s + Number(l.credit), 0);
            return (
              <Card key={entry.id} className="overflow-hidden">
                <div className="flex items-center justify-between border-b px-6 py-3">
                  <div>
                    <p className="font-semibold">{entry.entryNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString()} · {entry.description ?? entry.reference ?? "—"}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p>Dr {debit.toLocaleString()}</p>
                    <p>Cr {credit.toLocaleString()}</p>
                  </div>
                </div>
                <DataTable
                  columns={lineColumns}
                  data={(entry.lines ?? []) as JournalLineRow[]}
                  dense
                  paginated={false}
                />
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
            <DialogDescription>Debits and credits must balance to post.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Reference (optional)</Label>
                <Input id="reference" name="reference" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" name="description" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lines</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setLines((prev) => [...prev, { accountCode: "", description: "", debit: "", credit: "" }])
                  }
                >
                  <Plus className="h-3 w-3" /> Add line
                </Button>
              </div>
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                <span className="col-span-4">Account</span>
                <span className="col-span-2">Description</span>
                <span className="col-span-2">Debit</span>
                <span className="col-span-2">Credit</span>
                <span className="col-span-2" />
              </div>
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 items-center gap-2">
                  <Select
                    value={line.accountCode || undefined}
                    onValueChange={(v) => setLine(idx, { accountCode: v })}
                  >
                    <SelectTrigger className="col-span-4">
                      <SelectValue placeholder="Account code" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a: { code: string; name: string }) => (
                        <SelectItem key={a.code} value={a.code}>
                          {a.code} · {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="col-span-2"
                    placeholder="Note"
                    value={line.description}
                    onChange={(e) => setLine(idx, { description: e.target.value })}
                  />
                  <Input
                    className="col-span-2"
                    placeholder="0"
                    type="number"
                    step="0.01"
                    value={line.debit}
                    onChange={(e) => setLine(idx, { debit: e.target.value })}
                  />
                  <Input
                    className="col-span-2"
                    placeholder="0"
                    type="number"
                    step="0.01"
                    value={line.credit}
                    onChange={(e) => setLine(idx, { credit: e.target.value })}
                  />
                  <Button
                    className="col-span-2"
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={lines.length <= 2}
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Posting…" : "Post entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}