"use client";

import useSWR from "swr";
import { useState } from "react";
import { PageHeader } from "@/components/modules/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Section({ title, rows, money }: { title: string; rows: any[]; money?: boolean }) {
  if (rows.length === 0) return null;
  return (
    <>
      <TableRow className="bg-muted/50">
        <TableCell colSpan={2} className="font-semibold">
          {title}
        </TableCell>
        <TableCell className="text-right font-semibold" />
      </TableRow>
      {rows.map((r) => (
        <TableRow key={r.code}>
          <TableCell className="font-mono text-xs">{r.code}</TableCell>
          <TableCell>{r.name}</TableCell>
          <TableCell className="text-right">
            {money ? fmt(r.balance) : fmt(r.balance)}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function ReportsClient() {
  const [type, setType] = useState("pl");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [accountId, setAccountId] = useState("");

  const params = new URLSearchParams({ type });
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  if (accountId && type === "general_ledger") params.set("accountId", accountId);

  const { data, isLoading } = useSWR(`/api/accounting/reports?${params.toString()}`, fetcher);
  const { data: acctData } = useSWR("/api/accounting/accounts", fetcher);
  const report = data?.report;
  const accounts = acctData?.accounts ?? [];

  return (
    <div>
      <PageHeader title="Reports" description="Financial statements generated from posted journal entries." />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Tabs value={type} onValueChange={setType}>
          <TabsList>
            <TabsTrigger value="pl">Profit &amp; Loss</TabsTrigger>
            <TabsTrigger value="balance_sheet">Balance Sheet</TabsTrigger>
            <TabsTrigger value="trial_balance">Trial Balance</TabsTrigger>
            <TabsTrigger value="general_ledger">General Ledger</TabsTrigger>
          </TabsList>
        </Tabs>
        {type === "pl" && (
          <>
            <div className="space-y-1">
              <Label>From (optional)</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="space-y-1">
              <Label>To (optional)</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-40" />
            </div>
          </>
        )}
        {type === "balance_sheet" && (
          <div className="space-y-1">
            <Label>As of (optional)</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-40" />
          </div>
        )}
        {type === "general_ledger" && (
          <div className="space-y-1">
            <Label>Account filter</Label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">All accounts</option>
              {accounts.map((a: { id: string; code: string; name: string }) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : type === "pl" ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Profit &amp; Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Section title="Revenue" rows={report?.revenueAccounts ?? []} />
                <TableRow className="font-medium">
                  <TableCell colSpan={2}>Total revenue</TableCell>
                  <TableCell className="text-right">{fmt(report?.revenue ?? 0)}</TableCell>
                </TableRow>
                <Section title="Expenses" rows={report?.expenseAccounts ?? []} />
                <TableRow className="font-medium">
                  <TableCell colSpan={2}>Total expenses</TableCell>
                  <TableCell className="text-right">{fmt(report?.expenses ?? 0)}</TableCell>
                </TableRow>
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={2}>Net income</TableCell>
                  <TableCell className="text-right">{fmt(report?.netIncome ?? 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : type === "balance_sheet" ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Balance Sheet</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Section title="Assets" rows={report?.assetAccounts ?? []} />
                <TableRow className="font-medium">
                  <TableCell colSpan={2}>Total assets</TableCell>
                  <TableCell className="text-right">{fmt(report?.totalAssets ?? 0)}</TableCell>
                </TableRow>
                <Section title="Liabilities" rows={report?.liabilityAccounts ?? []} />
                <TableRow className="font-medium">
                  <TableCell colSpan={2}>Total liabilities</TableCell>
                  <TableCell className="text-right">{fmt(report?.totalLiabilities ?? 0)}</TableCell>
                </TableRow>
                <Section title="Equity" rows={report?.equityAccounts ?? []} />
                <TableRow className="font-medium">
                  <TableCell colSpan={2}>Total equity</TableCell>
                  <TableCell className="text-right">{fmt(report?.totalEquity ?? 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : type === "trial_balance" ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Trial Balance</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant={report?.balanced ? "success" : "destructive"}>
                {report?.balanced ? "Balanced" : "Out of balance"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Dr {fmt(report?.totalDebit ?? 0)} · Cr {fmt(report?.totalCredit ?? 0)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(report?.rows ?? []).map((r: any) => (
                  <TableRow key={r.code + r.name}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right">{r.debit ? fmt(r.debit) : "—"}</TableCell>
                    <TableCell className="text-right">{r.credit ? fmt(r.credit) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">General Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(report ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No ledger entries.
                    </TableCell>
                  </TableRow>
                ) : (
                  (report ?? []).map((l: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{new Date(l.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-mono text-xs">{l.entryNumber}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs">{l.accountCode}</span> {l.accountName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{l.description ?? l.reference ?? "—"}</TableCell>
                      <TableCell className="text-right">{l.debit ? fmt(l.debit) : "—"}</TableCell>
                      <TableCell className="text-right">{l.credit ? fmt(l.credit) : "—"}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(l.runningBalance)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}