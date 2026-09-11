"use client";

import useSWR from "swr";
import { useState } from "react";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/modules/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type BalanceRow = { code: string; name: string; balance: number; accountId: string | null };
type RecentRow = {
  id: string;
  entryNumber: string;
  date: string;
  reference: string | null;
  description: string | null;
  lines: { account: { code: string }; debit: number; credit: number }[];
  createdBy: { name: string | null } | null;
};

export function RemittancesClient() {
  const { data, mutate, isLoading } = useSWR("/api/accounting/remittances", fetcher);
  const [paying, setPaying] = useState<BalanceRow | null>(null);
  const [saving, setSaving] = useState(false);

  const balances: BalanceRow[] = data?.balances ?? [];
  const recent: RecentRow[] = data?.recent ?? [];

  const columns: ColumnDef<BalanceRow>[] = [
    {
      accessorFn: (b) => b.code,
      id: "code",
      header: "Code",
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.code}</span>,
    },
    {
      accessorFn: (b) => b.name,
      id: "name",
      header: "Liability account",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorFn: (b) => b.balance,
      id: "balance",
      header: "Balance",
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => {
        const balance = Number(row.original.balance);
        return balance > 0 ? (
          <span className="font-semibold text-destructive">{balance.toLocaleString()}</span>
        ) : (
          <span className="text-muted-foreground">{balance.toLocaleString()}</span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { headerClassName: "text-right", cellClassName: "text-right" },
      cell: ({ row }) => {
        const balance = Number(row.original.balance);
        return balance > 0 && row.original.accountId ? (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" className="h-7" onClick={() => setPaying(row.original)}>
              <Landmark className="h-3 w-3" /> Remit
            </Button>
          </div>
        ) : null;
      },
    },
  ];

  async function remit(e: React.FormEvent<HTMLFormElement>) {
    if (!paying) return;
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      code: paying.code,
      amount: Number(formData.get("amount")),
      date: formData.get("date") as string,
      reference: (formData.get("reference") as string) || undefined,
    };
    setSaving(true);
    const res = await fetch("/api/accounting/remittances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Remittance journal posted");
      setPaying(null);
      mutate();
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to post remittance");
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader title="Statutory Remittances" description="Payment journals to settle payroll & statutory liability accounts." />

      {isLoading ? (
        <Card className="p-4 text-sm text-muted-foreground">Loading balances…</Card>
      ) : (
        <Card className="overflow-hidden p-2">
          <DataTable
            columns={columns}
            data={balances as BalanceRow[]}
            filterKeys={["code", "name"]}
            searchPlaceholder="Search liability accounts…"
            emptyMessage="No liability accounts"
            pageSize={10}
            paginated={false}
          />
        </Card>
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold">Recent remittances</h2>
      <Card className="overflow-hidden p-2">
        {recent.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No remittances recorded yet.</p>
        ) : (
          <DataTable
            columns={[
              {
                accessorFn: (r) => r.entryNumber,
                id: "entry",
                header: "Entry",
                cell: ({ row }) => <span className="font-mono text-sm">{row.original.entryNumber}</span>,
              },
              {
                accessorFn: (r) => new Date(r.date).getTime(),
                id: "date",
                header: "Date",
                cell: ({ row }) => <span>{new Date(row.original.date).toLocaleDateString()}</span>,
              },
              {
                accessorFn: (r) => r.reference ?? "",
                id: "reference",
                header: "Reference",
                cell: ({ row }) => <span className="font-medium">{row.original.reference ?? "—"}</span>,
              },
              {
                accessorFn: (r) => r.lines[0]?.account.code ?? "",
                id: "account",
                header: "Account",
                cell: ({ row }) => <span>{row.original.lines[0]?.account.code ?? "—"}</span>,
              },
              {
                accessorFn: (r) => Math.max(Number(r.lines[0]?.debit ?? 0), Number(r.lines[0]?.credit ?? 0)),
                id: "amount",
                header: "Amount",
                meta: { headerClassName: "text-right", cellClassName: "text-right" },
                cell: ({ row }) => {
                  const first = row.original.lines[0];
                  const amount = Math.max(Number(first?.debit ?? 0), Number(first?.credit ?? 0));
                  return <span>{amount.toLocaleString()}</span>;
                },
              },
              {
                accessorFn: (r) => r.createdBy?.name ?? "",
                id: "by",
                header: "By",
                cell: ({ row }) => <span className="text-muted-foreground">{row.original.createdBy?.name ?? "—"}</span>,
              },
            ]}
            data={recent as RecentRow[]}
            filterKeys={["entryNumber", "reference"]}
            emptyMessage="No remittances"
            pageSize={10}
          />
        )}
      </Card>

      <Dialog open={paying !== null} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remit {paying?.name ?? ""}</DialogTitle>
            <DialogDescription>
              Books: Dr {paying?.code ?? ""} liability payable, Cr payroll clearing (bank). Reuse the code above the balance.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={remit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="remit-amount">Amount</Label>
                <Input
                  id="remit-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  max={paying?.balance ?? undefined}
                  defaultValue={paying?.balance ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remit-date">Date</Label>
                <Input id="remit-date" name="date" type="date" defaultValue={today} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="remit-ref">Reference</Label>
              <Input id="remit-ref" name="reference" placeholder="e.g. PAYE Sept remittance" />
            </div>
            {paying && Number(paying.balance) > 0 && (
              <p className="text-xs text-muted-foreground">
                Current liability balance: {Number(paying.balance).toLocaleString()}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPaying(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Posting…" : "Post remittance"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}