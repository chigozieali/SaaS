"use client";

import useSWR from "swr";
import { useState } from "react";
import { Plus, Trash2, Eye } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { JournalDetail, type JournalEntryRow } from "@/components/accounting/journal-detail";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Line = { accountCode: string; description: string; debit: string; credit: string };

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

const totals = (entry: JournalEntryRow) => ({
  debit: entry.lines.reduce((s, l) => s + Number(l.debit), 0),
  credit: entry.lines.reduce((s, l) => s + Number(l.credit), 0),
});

export function JournalClient() {
  const { data, mutate } = useSWR("/api/accounting/journal", fetcher);
  const { data: acctData } = useSWR("/api/accounting/accounts", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<JournalEntryRow | null>(null);
  const [lines, setLines] = useState<Line[]>([
    { accountCode: "", description: "", debit: "", credit: "" },
    { accountCode: "", description: "", debit: "", credit: "" },
  ]);

  const entries = (data?.entries ?? []) as JournalEntryRow[];
  const accounts = acctData?.accounts ?? [];

  const columns: ColumnDef<JournalEntryRow>[] = [
    {
      accessorKey: "entryNumber",
      header: "Entry",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.entryNumber}</span>,
    },
    {
      accessorFn: (entry) => new Date(entry.date).getTime(),
      id: "date",
      header: "Date",
      cell: ({ row }) => <span>{new Date(row.original.date).toLocaleDateString()}</span>,
    },
    {
      accessorFn: (entry) => entry.reference ?? entry.description ?? "",
      id: "reference",
      header: "Reference",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.reference ?? "—"}</span>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.description ?? "—"}</span>
      ),
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => <span>{row.original.source ?? "—"}</span>,
    },
    {
      accessorFn: (entry) => totals(entry).debit,
      id: "debit",
      header: "Debit",
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => <span>{totals(row.original).debit.toLocaleString()}</span>,
    },
    {
      accessorFn: (entry) => totals(entry).credit,
      id: "credit",
      header: "Credit",
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => <span>{totals(row.original).credit.toLocaleString()}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => (
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSelected(row.original)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

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
      toast.success("Journal entry saved as draft");
      mutate();
      setOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to save entry");
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
          description="Create your first journal entry."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Entry
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={entries}
            filterKeys={["entryNumber", "reference", "description", "source"]}
            searchPlaceholder="Search journal entries…"
            emptyMessage="No entries match your search"
            pageSize={10}
          />
        </Card>
      )}

      <JournalDetail
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
        entry={selected}
        onMutate={mutate}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
            <DialogDescription>
              Debits and credits must balance. Entries are saved as drafts, then submitted for
              approval before posting.
            </DialogDescription>
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
                {saving ? "Saving…" : "Save draft"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}