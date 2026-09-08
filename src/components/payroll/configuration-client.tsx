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
import { Badge } from "@/components/ui/badge";
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
const calcTypes = ["fixed", "percent_basic", "percent_gross", "percent_of_tax"];

type TaxRow = { lower: string; upper: string; rate: string };
type RuleRow = { name: string; type: string; value: string; cap: string };
type ContribRow = { name: string; contributor: string; type: string; value: string; cap: string };

type TaxBracketRow = { id: string; lowerBound: number; upperBound: number | null; rate: number };
type DeductionRuleRow = { id: string; name: string; calculationType: string; value: number };
type ContributionRuleRow = {
  id: string;
  name: string;
  contributor: string;
  calculationType: string;
  value: number;
};

const calcTypeLabel: Record<string, string> = {
  fixed: "Fixed",
  percent_basic: "% of basic",
  percent_gross: "% of gross",
  percent_of_tax: "% of tax",
};

const taxBracketColumns: ColumnDef<TaxBracketRow>[] = [
  {
    accessorFn: (r) => Number(r.lowerBound),
    id: "from",
    header: "From",
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
    cell: ({ row }) => <span>{Number(row.original.lowerBound).toLocaleString()}</span>,
  },
  {
    accessorFn: (r) => (r.upperBound ? Number(r.upperBound) : Infinity),
    id: "to",
    header: "To",
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
    cell: ({ row }) =>
      row.original.upperBound ? (
        <span>{Number(row.original.upperBound).toLocaleString()}</span>
      ) : (
        <span>∞</span>
      ),
  },
  {
    accessorFn: (r) => Number(r.rate),
    id: "rate",
    header: "Rate",
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
    cell: ({ row }) => <span>{Number(row.original.rate)}%</span>,
  },
];

const deductionRuleColumns: ColumnDef<DeductionRuleRow>[] = [
  { accessorKey: "name", header: "Name", cell: ({ row }) => <span>{row.original.name}</span> },
  {
    accessorFn: (r) => r.calculationType,
    id: "type",
    header: "Type",
    cell: ({ row }) => (
      <span>{calcTypeLabel[row.original.calculationType] ?? row.original.calculationType}</span>
    ),
  },
  {
    accessorFn: (r) => Number(r.value),
    id: "value",
    header: "Value",
    meta: { headerClassName: "text-right", cellClassName: "text-right" },
    cell: ({ row }) => <span>{Number(row.original.value).toLocaleString()}</span>,
  },
];

const contributionRuleColumns: ColumnDef<ContributionRuleRow>[] = [
  { accessorKey: "name", header: "Name", cell: ({ row }) => <span>{row.original.name}</span> },
  {
    accessorKey: "contributor",
    header: "Side",
    cell: ({ row }) => <span>{row.original.contributor}</span>,
  },
  {
    accessorFn: (r) => `${r.calculationType} ${Number(r.value)}`,
    id: "value",
    header: "Value",
    cell: ({ row }) => (
      <span>
        {calcTypeLabel[row.original.calculationType] ?? row.original.calculationType}{" "}
        {Number(row.original.value).toLocaleString()}
      </span>
    ),
  },
];

export function ConfigurationClient() {
  const { data, mutate } = useSWR("/api/payroll/configuration", fetcher);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [countryCode, setCountryCode] = useState("");
  const [taxBrackets, setTaxBrackets] = useState<TaxRow[]>([{ lower: "0", upper: "", rate: "" }]);
  const [deductions, setDeductions] = useState<RuleRow[]>([]);
  const [contributions, setContributions] = useState<ContribRow[]>([]);

  const configs = data?.configs ?? [];
  const countries = data?.countries ?? [];

  function newRule(name = ""): RuleRow {
    return { name, type: "percent_gross", value: "", cap: "" };
  }
  function newContrib(name = ""): ContribRow {
    return { name, contributor: "employee", type: "percent_gross", value: "", cap: "" };
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      countryCode,
      name: formData.get("name"),
      currency: formData.get("currency"),
      taxYear: (formData.get("taxYear") as string) || undefined,
      effectiveFrom: formData.get("effectiveFrom"),
      taxRules: taxBrackets
        .filter((b) => b.lower !== "" && b.rate !== "")
        .map((b, idx) => ({
          bracketOrder: idx,
          lowerBound: Number(b.lower),
          upperBound: b.upper ? Number(b.upper) : null,
          rate: Number(b.rate),
          baseAmount: null,
        })),
      deductionRules: deductions
        .filter((d) => d.name && d.value !== "")
        .map((d) => ({
          name: d.name,
          calculationType: d.type,
          value: Number(d.value),
          cap: d.cap ? Number(d.cap) : null,
        })),
      contributionRules: contributions
        .filter((c) => c.name && c.value !== "")
        .map((c) => ({
          name: c.name,
          contributor: c.contributor,
          calculationType: c.type,
          value: Number(c.value),
          cap: c.cap ? Number(c.cap) : null,
        })),
    };

    setSaving(true);
    const res = await fetch("/api/payroll/configuration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Payroll configuration saved");
      mutate();
      setOpen(false);
    } else {
      const data = await res.json().catch(() => null);
      toast.error(data?.message ?? "Failed to save configuration");
    }
  }

  return (
    <div>
      <PageHeader title="Payroll Configuration" description="Define tax brackets, deductions and employer contributions per country.">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Configuration
        </Button>
      </PageHeader>

      {configs.length === 0 ? (
        <EmptyState
          title="No payroll configurations"
          description="Define one to enable payroll calculations for your organization."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Configuration
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {configs.map((config: Record<string, any>) => (
            <Card key={config.id} className="overflow-hidden">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <p className="font-semibold">
                    {config.name} ({config.country.name}) · {config.currency}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Effective {new Date(config.effectiveFrom).toLocaleDateString()} · Tax year {config.taxYear ?? "—"}
                    <Badge variant={config.isActive ? "success" : "outline"} className="ml-2">
                      {config.isActive ? "Active" : "Superseded"}
                    </Badge>
                  </p>
                </div>
              </div>
              <div className="grid gap-6 p-6 md:grid-cols-3">
                <div>
                  <h3 className="mb-2 text-sm font-medium">Tax brackets</h3>
                  <DataTable
                    columns={taxBracketColumns}
                    data={(config.taxRules ?? []) as TaxBracketRow[]}
                    dense
                    paginated={false}
                  />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium">Deductions</h3>
                  {config.deductionRules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None</p>
                  ) : (
                    <DataTable
                      columns={deductionRuleColumns}
                      data={(config.deductionRules ?? []) as DeductionRuleRow[]}
                      dense
                      paginated={false}
                    />
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium">Contributions</h3>
                  {config.contributionRules.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None</p>
                  ) : (
                    <DataTable
                      columns={contributionRuleColumns}
                      data={(config.contributionRules ?? []) as ContributionRuleRow[]}
                      dense
                      paginated={false}
                    />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Payroll Configuration</DialogTitle>
            <DialogDescription>Define the tax schedule and deduction/contribution rules used by the payroll engine.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={countryCode || undefined} onValueChange={setCountryCode}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c: { code: string; name: string }) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency code</Label>
                <Input id="currency" name="currency" placeholder="NGN" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Configuration name</Label>
                <Input id="name" name="name" placeholder="Nigeria PAYE 2026" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxYear">Tax year</Label>
                <Input id="taxYear" name="taxYear" placeholder="2026" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="effectiveFrom">Effective from</Label>
              <Input id="effectiveFrom" name="effectiveFrom" type="date" required />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Tax brackets (annual)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTaxBrackets((prev) => [...prev, { lower: "", upper: "", rate: "" }])}
                >
                  <Plus className="h-3 w-3" /> Add bracket
                </Button>
              </div>
              <div className="space-y-2">
                {taxBrackets.map((b, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="From"
                      type="number"
                      value={b.lower}
                      onChange={(e) =>
                        setTaxBrackets((prev) => prev.map((r, i) => (i === idx ? { ...r, lower: e.target.value } : r)))
                      }
                    />
                    <Input
                      placeholder="To (blank = ∞)"
                      type="number"
                      value={b.upper}
                      onChange={(e) =>
                        setTaxBrackets((prev) => prev.map((r, i) => (i === idx ? { ...r, upper: e.target.value } : r)))
                      }
                    />
                    <Input
                      placeholder="Rate %"
                      type="number"
                      step="0.01"
                      value={b.rate}
                      onChange={(e) =>
                        setTaxBrackets((prev) => prev.map((r, i) => (i === idx ? { ...r, rate: e.target.value } : r)))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setTaxBrackets((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Deductions (from employee pay)</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDeductions((prev) => [...prev, newRule("")])}>
                  <Plus className="h-3 w-3" /> Add deduction
                </Button>
              </div>
              <div className="space-y-2">
                {deductions.map((d, idx) => (
                  <div key={idx} className="grid grid-cols-12 items-center gap-2">
                    <Input
                      className="col-span-3"
                      placeholder="Name"
                      value={d.name}
                      onChange={(e) =>
                        setDeductions((prev) => prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))
                      }
                    />
                    <Select
                      value={d.type}
                      onValueChange={(v) =>
                        setDeductions((prev) => prev.map((r, i) => (i === idx ? { ...r, type: v } : r)))
                      }
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {calcTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {calcTypeLabel[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="col-span-2"
                      placeholder="Value"
                      type="number"
                      step="0.01"
                      value={d.value}
                      onChange={(e) =>
                        setDeductions((prev) => prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)))
                      }
                    />
                    <Input
                      className="col-span-3"
                      placeholder="Cap (optional)"
                      type="number"
                      step="0.01"
                      value={d.cap}
                      onChange={(e) =>
                        setDeductions((prev) => prev.map((r, i) => (i === idx ? { ...r, cap: e.target.value } : r)))
                      }
                    />
                    <Button
                      className="col-span-1"
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeductions((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Contributions (employee/employer)</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setContributions((prev) => [...prev, newContrib("")])}>
                  <Plus className="h-3 w-3" /> Add contribution
                </Button>
              </div>
              <div className="space-y-2">
                {contributions.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-12 items-center gap-2">
                    <Input
                      className="col-span-3"
                      placeholder="Name"
                      value={c.name}
                      onChange={(e) =>
                        setContributions((prev) => prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))
                      }
                    />
                    <Select
                      value={c.contributor}
                      onValueChange={(v) =>
                        setContributions((prev) => prev.map((r, i) => (i === idx ? { ...r, contributor: v } : r)))
                      }
                    >
                      <SelectTrigger className="col-span-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="employer">Employer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={c.type}
                      onValueChange={(v) =>
                        setContributions((prev) => prev.map((r, i) => (i === idx ? { ...r, type: v } : r)))
                      }
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {calcTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {calcTypeLabel[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="col-span-1"
                      placeholder="Val"
                      type="number"
                      step="0.01"
                      value={c.value}
                      onChange={(e) =>
                        setContributions((prev) => prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)))
                      }
                    />
                    <Input
                      className="col-span-2"
                      placeholder="Cap"
                      type="number"
                      step="0.01"
                      value={c.cap}
                      onChange={(e) =>
                        setContributions((prev) => prev.map((r, i) => (i === idx ? { ...r, cap: e.target.value } : r)))
                      }
                    />
                    <Button
                      className="col-span-1"
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setContributions((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save configuration"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}